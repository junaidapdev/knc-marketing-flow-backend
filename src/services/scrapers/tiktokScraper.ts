import { env } from '../../config/env';
import { DEFAULT_POST_FETCH_LIMIT } from '../../constants/platforms';
import type { PostData, ProfileSnapshot } from '../../types/domain/platform';
import { apifyClient, type ApifyClient } from './apifyClient';
import type { PlatformScraper } from './types';

interface TikTokItem {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number;
  hashtags?: Array<{ name?: string } | string>;
  videoMeta?: { duration?: number; coverUrl?: string };
  authorMeta?: {
    fans?: number;
    heart?: number;
    heartCount?: number;
    video?: number;
    videoCount?: number;
  };
}

function stripLeadingAt(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1) : handle;
}

function normalizeHashtags(raw: TikTokItem['hashtags']): string[] {
  if (!raw) return [];
  return raw
    .map((h) => (typeof h === 'string' ? h : h.name))
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function toPostData(item: TikTokItem): PostData | null {
  if (!item.id) return null;
  return {
    externalId: item.id,
    url: item.webVideoUrl ?? null,
    caption: item.text ?? null,
    postedAt: item.createTimeISO ?? null,
    durationSeconds: item.videoMeta?.duration ?? null,
    plays: item.playCount ?? null,
    likes: item.diggCount ?? null,
    comments: item.commentCount ?? null,
    shares: item.shareCount ?? null,
    saves: item.collectCount ?? null,
    hashtags: normalizeHashtags(item.hashtags),
    thumbnailUrl: item.videoMeta?.coverUrl ?? null,
  };
}

function extractProfileFromPosts(items: TikTokItem[]): ProfileSnapshot {
  // Most TikTok actors embed profile stats on every item's `authorMeta`.
  const first = items.find((i) => i.authorMeta);
  const author = first?.authorMeta;
  return {
    followers: author?.fans ?? null,
    totalLikes: author?.heartCount ?? author?.heart ?? null,
    totalVideos: author?.videoCount ?? author?.video ?? null,
  };
}

export class TikTokScraper implements PlatformScraper {
  readonly platform = 'tiktok' as const;

  constructor(private readonly client: ApifyClient = apifyClient) {}

  async fetchProfile(handle: string): Promise<ProfileSnapshot> {
    const items = await this.runActor(handle, 1);
    return extractProfileFromPosts(items);
  }

  async fetchRecentPosts(
    handle: string,
    limit: number = DEFAULT_POST_FETCH_LIMIT,
  ): Promise<PostData[]> {
    const items = await this.runActor(handle, limit);
    return items.map(toPostData).filter((p): p is PostData => p !== null);
  }

  private async runActor(handle: string, resultsPerPage: number): Promise<TikTokItem[]> {
    const profiles = [stripLeadingAt(handle)];
    return this.client.runActorAndGetItems<Record<string, unknown>, TikTokItem>(
      env.APIFY_TIKTOK_ACTOR_ID,
      { profiles, resultsPerPage, shouldDownloadVideos: false },
    );
  }
}
