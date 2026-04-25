import type { Platform, PostData, ProfileSnapshot } from '../../types/domain/platform';

export interface PlatformScraper {
  platform: Platform;
  fetchProfile(handle: string): Promise<ProfileSnapshot>;
  /** TikTok + Instagram only — Snapchat is growth-only for V1. */
  fetchRecentPosts?: (handle: string, limit?: number) => Promise<PostData[]>;
}
