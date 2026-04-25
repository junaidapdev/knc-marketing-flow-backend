import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { PLATFORM_OPTIONS } from '../constants/platforms';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { TableRow } from '../types/database';
import type { Platform } from '../types/domain/platform';
import type { SocialPost } from '../types/domain/socialPost';
import type { SocialSnapshot } from '../types/domain/socialSnapshot';
import type { SocialSyncLog, SyncStatus } from '../types/domain/socialSyncLog';
import type { PostsQuery, SnapshotsQuery } from '../schemas/social';

type SnapshotRow = TableRow<'social_snapshots'>;
type PostRow = TableRow<'social_posts'>;
type LogRow = TableRow<'social_sync_log'>;

const MS_PER_DAY = 86_400_000;
const KPI_SHORT_WINDOW_DAYS = 7;
const KPI_LONG_WINDOW_DAYS = 30;
const SYNC_LOG_LOOKBACK = 50;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toSnapshot(row: SnapshotRow): SocialSnapshot {
  return {
    id: row.id,
    platform: row.platform,
    brandId: row.brand_id,
    capturedAt: row.captured_at,
    followers: row.followers,
    totalLikes: row.total_likes === null ? null : Number(row.total_likes),
    totalVideos: row.total_videos,
    createdAt: row.created_at,
  };
}

function toPost(row: PostRow): SocialPost {
  return {
    id: row.id,
    platform: row.platform,
    brandId: row.brand_id,
    externalId: row.external_id,
    url: row.url,
    caption: row.caption,
    postedAt: row.posted_at,
    durationSeconds: row.duration_seconds,
    plays: row.plays === null ? null : Number(row.plays),
    likes: row.likes === null ? null : Number(row.likes),
    comments: row.comments === null ? null : Number(row.comments),
    shares: row.shares === null ? null : Number(row.shares),
    saves: row.saves === null ? null : Number(row.saves),
    hashtags: row.hashtags,
    thumbnailUrl: row.thumbnail_url,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

function toSyncLog(row: LogRow): SocialSyncLog {
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

// ---- Snapshots ----------------------------------------------------------

export async function listSnapshots(filters: SnapshotsQuery): Promise<SocialSnapshot[]> {
  const since = new Date(Date.now() - filters.days * MS_PER_DAY).toISOString();
  let q = db
    .from(TABLES.SOCIAL_SNAPSHOTS)
    .select('*')
    .gte('captured_at', since)
    .order('captured_at');
  if (filters.platform) q = q.eq('platform', filters.platform);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as SnapshotRow[]).map(toSnapshot);
}

// ---- KPIs ---------------------------------------------------------------

export interface PlatformKpi {
  platform: Platform;
  followers: number | null;
  capturedAt: string | null;
  delta7d: number | null;
  delta30d: number | null;
}

interface KpiRow {
  platform: Platform;
  captured_at: string;
  followers: number | null;
}

async function loadKpiHistory(platform: Platform): Promise<KpiRow[]> {
  const since = new Date(Date.now() - (KPI_LONG_WINDOW_DAYS + 1) * MS_PER_DAY).toISOString();
  const { data, error } = await db
    .from(TABLES.SOCIAL_SNAPSHOTS)
    .select('platform, captured_at, followers')
    .eq('platform', platform)
    .gte('captured_at', since)
    .order('captured_at');
  if (error) throw dbError(error);
  return (data ?? []) as KpiRow[];
}

function findOldestInWindow(rows: KpiRow[], windowStart: Date): KpiRow | null {
  // rows are ordered ascending by captured_at; pick the first row whose
  // timestamp >= windowStart. That's the oldest snapshot still inside
  // the [windowStart, now] window — what "delta over N days" really
  // asks: how much did followers grow during this window?
  const windowMs = windowStart.getTime();
  for (const r of rows) {
    if (new Date(r.captured_at).getTime() >= windowMs) return r;
  }
  return null;
}

export async function computeKpis(): Promise<PlatformKpi[]> {
  const now = new Date();
  const sevenStart = new Date(now.getTime() - KPI_SHORT_WINDOW_DAYS * MS_PER_DAY);
  const thirtyStart = new Date(now.getTime() - KPI_LONG_WINDOW_DAYS * MS_PER_DAY);

  const out: PlatformKpi[] = [];
  for (const platform of PLATFORM_OPTIONS) {
    const rows = await loadKpiHistory(platform);
    const latest = rows[rows.length - 1] ?? null;
    const sevenAnchor = findOldestInWindow(rows, sevenStart);
    const thirtyAnchor = findOldestInWindow(rows, thirtyStart);

    const followers = latest?.followers ?? null;
    const capturedAt = latest?.captured_at ?? null;
    // Only emit a delta when the anchor is a *different* row from the
    // latest one — otherwise the answer is trivially zero and not a
    // meaningful "growth" signal.
    const delta7d =
      followers !== null && sevenAnchor && sevenAnchor !== latest && sevenAnchor.followers != null
        ? followers - sevenAnchor.followers
        : null;
    const delta30d =
      followers !== null &&
      thirtyAnchor &&
      thirtyAnchor !== latest &&
      thirtyAnchor.followers != null
        ? followers - thirtyAnchor.followers
        : null;

    out.push({ platform, followers, capturedAt, delta7d, delta30d });
  }
  return out;
}

// ---- Posts --------------------------------------------------------------

export async function listPosts(filters: PostsQuery): Promise<SocialPost[]> {
  let q = db
    .from(TABLES.SOCIAL_POSTS)
    .select('*')
    .order(filters.sortBy, { ascending: false, nullsFirst: false })
    .limit(filters.limit);
  if (filters.platform) q = q.eq('platform', filters.platform);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as PostRow[]).map(toPost);
}

// ---- Sync status --------------------------------------------------------

export interface SyncStatusSummary {
  lastSync: string | null;
  status: SyncStatus | null;
  platform: Platform | null;
  error: string | null;
  lastByPlatform: Array<{
    platform: Platform;
    status: SyncStatus;
    finishedAt: string | null;
    error: string | null;
  }>;
}

export async function getSyncStatus(): Promise<SyncStatusSummary> {
  const { data, error } = await db
    .from(TABLES.SOCIAL_SYNC_LOG)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(SYNC_LOG_LOOKBACK);
  if (error) throw dbError(error);

  const rows = ((data ?? []) as LogRow[]).map(toSyncLog);
  const latest = rows[0] ?? null;

  const lastByPlatform: SyncStatusSummary['lastByPlatform'] = [];
  for (const platform of PLATFORM_OPTIONS) {
    const row = rows.find((r) => r.platform === platform);
    if (row) {
      lastByPlatform.push({
        platform,
        status: row.status,
        finishedAt: row.finishedAt,
        error: row.errorMessage,
      });
    }
  }

  return {
    lastSync: latest?.finishedAt ?? latest?.startedAt ?? null,
    status: latest?.status ?? null,
    platform: latest?.platform ?? null,
    error: latest?.errorMessage ?? null,
    lastByPlatform,
  };
}
