import { z } from 'zod';

const PLATFORM = z.enum(['tiktok', 'instagram', 'snapchat']);

export const syncQuerySchema = z.object({
  platform: PLATFORM.optional(),
});

const MIN_DAYS = 1;
const MAX_DAYS = 365;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 30;

export const snapshotsQuerySchema = z.object({
  platform: PLATFORM.optional(),
  days: z.coerce.number().int().min(MIN_DAYS).max(MAX_DAYS).default(DEFAULT_DAYS),
});

export const postsQuerySchema = z.object({
  platform: PLATFORM.optional(),
  sortBy: z.enum(['plays', 'likes', 'comments', 'shares', 'saves', 'posted_at']).default('plays'),
  limit: z.coerce.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type SyncQuery = z.infer<typeof syncQuerySchema>;
export type SnapshotsQuery = z.infer<typeof snapshotsQuerySchema>;
export type PostsQuery = z.infer<typeof postsQuerySchema>;
