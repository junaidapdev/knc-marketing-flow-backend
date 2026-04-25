import { env } from '../../config/env';
import { DEFAULT_POST_FETCH_LIMIT } from '../../constants/platforms';
import type { PostData, ProfileSnapshot } from '../../types/domain/platform';
import { apifyClient, type ApifyClient } from './apifyClient';
import type { PlatformScraper } from './types';

interface InstagramItem {
  id?: string;
  shortCode?: string;
  url?: string;
  caption?: string;
  timestamp?: string;
  videoDuration?: number;
  videoPlayCount?: number;
  videoViewCount?: number;
  likesCount?: number;
  commentsCount?: number;
  hashtags?: string[];
  displayUrl?: string;
  ownerFullName?: string;
  ownerUsername?: string;
  followersCount?: number;
  postsCount?: number;
}

function stripLeadingAt(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1) : handle;
}

function toPostData(item: InstagramItem): PostData | null {
  const externalId = item.id ?? item.shortCode;
  if (!externalId) return null;
  return {
    externalId,
    url: item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}` : null),
    caption: item.caption ?? null,
    postedAt: item.timestamp ?? null,
    durationSeconds: item.videoDuration ?? null,
    plays: item.videoPlayCount ?? item.videoViewCount ?? null,
    likes: item.likesCount ?? null,
    comments: item.commentsCount ?? null,
    shares: null,
    saves: null,
    hashtags: item.hashtags ?? [],
    thumbnailUrl: item.displayUrl ?? null,
  };
}

function extractProfileFromPosts(items: InstagramItem[]): ProfileSnapshot {
  // Apify's IG profile actor usually returns one "profile" item followed
  // by post items; either way we take the first record that has profile
  // stats attached.
  const withStats = items.find((i) => i.followersCount !== undefined);
  return {
    followers: withStats?.followersCount ?? null,
    totalLikes: null, // Not exposed by IG's public APIs.
    totalVideos: withStats?.postsCount ?? null,
  };
}

export class InstagramScraper implements PlatformScraper {
  readonly platform = 'instagram' as const;

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

  private async runActor(handle: string, resultsLimit: number): Promise<InstagramItem[]> {
    const usernames = [stripLeadingAt(handle)];
    return this.client.runActorAndGetItems<Record<string, unknown>, InstagramItem>(
      env.APIFY_IG_ACTOR_ID,
      { usernames, resultsLimit },
    );
  }
}
