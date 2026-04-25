import type { Platform } from './platform';

export interface SocialSnapshot {
  id: string;
  platform: Platform;
  brandId: string;
  capturedAt: string;
  followers: number | null;
  totalLikes: number | null;
  totalVideos: number | null;
  createdAt: string;
}
