import type { Platform } from './platform';

export interface SocialPost {
  id: string;
  platform: Platform;
  brandId: string;
  externalId: string;
  url: string | null;
  caption: string | null;
  postedAt: string | null;
  durationSeconds: number | null;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  hashtags: string[];
  thumbnailUrl: string | null;
  lastSyncedAt: string;
  createdAt: string;
}
