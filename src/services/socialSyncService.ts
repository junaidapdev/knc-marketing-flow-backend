import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { PLATFORM_OPTIONS } from '../constants/platforms';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { logger } from '../utils/logger';
import { HttpError } from '../middleware/errorHandler';
import type { TableRow } from '../types/database';
import type { Platform, PostData } from '../types/domain/platform';
import type { SocialSyncLog } from '../types/domain/socialSyncLog';
import { defaultScrapers, type PlatformScraper } from './scrapers';

type AccountRow = TableRow<'social_account'>;
type SyncLogRow = TableRow<'social_sync_log'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toSyncLog(row: SyncLogRow): SocialSyncLog {
  return {
    id: row.id,
    platform: row.platform,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    postsUpserted: row.posts_upserted,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

async function listActiveAccountsFor(platform?: Platform): Promise<AccountRow[]> {
  let q = db.from(TABLES.SOCIAL_ACCOUNT).select('*').eq('is_active', true);
  if (platform) q = q.eq('platform', platform);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return (data ?? []) as AccountRow[];
}

async function startSyncLog(platform: Platform, triggeredBy: string | null): Promise<SyncLogRow> {
  const { data, error } = await db
    .from(TABLES.SOCIAL_SYNC_LOG)
    .insert({
      platform,
      triggered_by: triggeredBy,
      status: 'running',
    })
    .select('*')
    .single();
  if (error) throw dbError(error);
  return data as SyncLogRow;
}

async function finalizeSyncLog(
  id: string,
  updates: {
    status: 'success' | 'failed';
    postsUpserted?: number;
    errorMessage?: string | null;
  },
): Promise<SyncLogRow> {
  const { data, error } = await db
    .from(TABLES.SOCIAL_SYNC_LOG)
    .update({
      status: updates.status,
      posts_upserted: updates.postsUpserted ?? 0,
      error_message: updates.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw dbError(error);
  return data as SyncLogRow;
}

async function insertSnapshot(
  platform: Platform,
  brandId: string,
  snapshot: { followers: number | null; totalLikes: number | null; totalVideos: number | null },
): Promise<void> {
  const { error } = await db.from(TABLES.SOCIAL_SNAPSHOTS).insert({
    platform,
    brand_id: brandId,
    followers: snapshot.followers,
    total_likes: snapshot.totalLikes,
    total_videos: snapshot.totalVideos,
  });
  if (error) throw dbError(error);
}

async function upsertPosts(
  platform: Platform,
  brandId: string,
  posts: PostData[],
): Promise<number> {
  if (posts.length === 0) return 0;
  const rows = posts.map((p) => ({
    platform,
    brand_id: brandId,
    external_id: p.externalId,
    url: p.url,
    caption: p.caption,
    posted_at: p.postedAt,
    duration_seconds: p.durationSeconds,
    plays: p.plays,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    hashtags: p.hashtags,
    thumbnail_url: p.thumbnailUrl,
    last_synced_at: new Date().toISOString(),
  }));

  // onConflict on (platform, external_id) — engagement numbers update,
  // created_at stays at its original value because we don't include it.
  const { error } = await db
    .from(TABLES.SOCIAL_POSTS)
    .upsert(rows, { onConflict: 'platform,external_id' });
  if (error) throw dbError(error);
  return rows.length;
}

export interface SyncOneResult {
  platform: Platform;
  log: SocialSyncLog;
}

async function syncOnePlatform(args: {
  platform: Platform;
  accounts: AccountRow[];
  scraper: PlatformScraper;
  triggeredBy: string | null;
}): Promise<SyncOneResult> {
  const log = await startSyncLog(args.platform, args.triggeredBy);
  try {
    let postsUpserted = 0;
    for (const account of args.accounts) {
      const snapshot = await args.scraper.fetchProfile(account.handle);
      await insertSnapshot(args.platform, account.brand_id, snapshot);
      if (args.scraper.fetchRecentPosts) {
        const posts = await args.scraper.fetchRecentPosts(account.handle);
        postsUpserted += await upsertPosts(args.platform, account.brand_id, posts);
      }
    }
    const finalized = await finalizeSyncLog(log.id, {
      status: 'success',
      postsUpserted,
    });
    return { platform: args.platform, log: toSyncLog(finalized) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, platform: args.platform }, 'social sync failed for platform');
    const finalized = await finalizeSyncLog(log.id, {
      status: 'failed',
      errorMessage: message,
    });
    return { platform: args.platform, log: toSyncLog(finalized) };
  }
}

export interface SyncRunSummary {
  logs: SocialSyncLog[];
  successCount: number;
  failedCount: number;
  totalPostsUpserted: number;
}

interface RunSocialSyncArgs {
  platform?: Platform;
  triggeredBy?: string | null;
  scrapers?: Readonly<Record<Platform, PlatformScraper>>;
}

export async function runSocialSync(args: RunSocialSyncArgs = {}): Promise<SyncRunSummary> {
  const scrapers = args.scrapers ?? defaultScrapers;
  const targets: Platform[] = args.platform ? [args.platform] : [...PLATFORM_OPTIONS];

  const accounts = await listActiveAccountsFor(args.platform);
  const byPlatform = new Map<Platform, AccountRow[]>();
  for (const p of targets) byPlatform.set(p, []);
  for (const a of accounts) {
    const bucket = byPlatform.get(a.platform);
    if (bucket) bucket.push(a);
  }

  const results: SocialSyncLog[] = [];
  for (const platform of targets) {
    const list = byPlatform.get(platform) ?? [];
    if (list.length === 0) {
      // No account configured → record a failed log so observability stays
      // honest about what was attempted.
      const log = await startSyncLog(platform, args.triggeredBy ?? null);
      const finalized = await finalizeSyncLog(log.id, {
        status: 'failed',
        errorMessage: ERRORS.SOCIAL_ACCOUNT_NOT_FOUND.message,
      });
      results.push(toSyncLog(finalized));
      continue;
    }
    const result = await syncOnePlatform({
      platform,
      accounts: list,
      scraper: scrapers[platform],
      triggeredBy: args.triggeredBy ?? null,
    });
    results.push(result.log);
  }

  return {
    logs: results,
    successCount: results.filter((r) => r.status === 'success').length,
    failedCount: results.filter((r) => r.status === 'failed').length,
    totalPostsUpserted: results.reduce((acc, r) => acc + r.postsUpserted, 0),
  };
}
