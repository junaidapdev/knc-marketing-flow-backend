import { z } from 'zod';

export const syncQuerySchema = z.object({
  platform: z.enum(['tiktok', 'instagram', 'snapchat']).optional(),
});

export type SyncQuery = z.infer<typeof syncQuerySchema>;
