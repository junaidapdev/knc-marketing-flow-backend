import type { Platform } from './platform';

export interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string;
  brandId: string;
  isActive: boolean;
  createdAt: string;
}
