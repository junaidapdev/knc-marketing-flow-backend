export type Platform = 'tiktok' | 'instagram' | 'snapchat';

export const PLATFORMS: readonly Platform[] = ['tiktok', 'instagram', 'snapchat'];

/** Growth metrics scraped from a profile page — all nullable because
 *  scrapers don't always expose every field. */
export interface ProfileSnapshot {
  followers: number | null;
  totalLikes: number | null;
  totalVideos: number | null;
}

/** Per-post engagement. `externalId` is the platform's stable post id
 *  and is the UPSERT key together with `platform`. */
export interface PostData {
  externalId: string;
  url: string | null;
  caption: string | null;
  postedAt: string | null; // ISO
  durationSeconds: number | null;
  plays: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  hashtags: string[];
  thumbnailUrl: string | null;
}
