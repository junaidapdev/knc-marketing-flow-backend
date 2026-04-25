import type { Platform } from './platform';

export type SyncStatus = 'running' | 'success' | 'failed';

export interface SocialSyncLog {
  id: string;
  platform: Platform;
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: SyncStatus;
  postsUpserted: number;
  errorMessage: string | null;
  createdAt: string;
}
