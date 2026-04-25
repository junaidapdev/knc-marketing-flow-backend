import { env } from '../../config/env';
import type { ProfileSnapshot } from '../../types/domain/platform';
import { apifyClient, type ApifyClient } from './apifyClient';
import type { PlatformScraper } from './types';

interface SnapItem {
  handle?: string;
  subscribers?: number;
  followers?: number;
  totalViews?: number;
  totalStories?: number;
  videoCount?: number;
}

function stripLeadingAt(handle: string): string {
  return handle.startsWith('@') ? handle.slice(1) : handle;
}

/**
 * Snapchat is growth-only for V1. The interface intentionally omits
 * `fetchRecentPosts` so callers can't mis-scrape individual stories yet.
 */
export class SnapchatScraper implements PlatformScraper {
  readonly platform = 'snapchat' as const;

  constructor(private readonly client: ApifyClient = apifyClient) {}

  async fetchProfile(handle: string): Promise<ProfileSnapshot> {
    const items = await this.client.runActorAndGetItems<Record<string, unknown>, SnapItem>(
      env.APIFY_SNAP_ACTOR_ID,
      { profiles: [stripLeadingAt(handle)] },
    );
    const first = items[0];
    if (!first) {
      return { followers: null, totalLikes: null, totalVideos: null };
    }
    return {
      followers: first.subscribers ?? first.followers ?? null,
      totalLikes: first.totalViews ?? null,
      totalVideos: first.totalStories ?? first.videoCount ?? null,
    };
  }
}
