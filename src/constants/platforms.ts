import type { Platform } from '../types/domain/platform';

export const PLATFORM_OPTIONS: readonly Platform[] = ['tiktok', 'instagram', 'snapchat'];

export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = Object.freeze({
  tiktok: 'TikTok',
  instagram: 'Instagram',
  snapchat: 'Snapchat',
});

export const DEFAULT_POST_FETCH_LIMIT = 20;
