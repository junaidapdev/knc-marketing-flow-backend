import type { Platform } from '../../types/domain/platform';
import { InstagramScraper } from './instagramScraper';
import { SnapchatScraper } from './snapchatScraper';
import { TikTokScraper } from './tiktokScraper';
import type { PlatformScraper } from './types';

export const defaultScrapers: Readonly<Record<Platform, PlatformScraper>> = Object.freeze({
  tiktok: new TikTokScraper(),
  instagram: new InstagramScraper(),
  snapchat: new SnapchatScraper(),
});

export type { PlatformScraper } from './types';
export { TikTokScraper, InstagramScraper, SnapchatScraper };
