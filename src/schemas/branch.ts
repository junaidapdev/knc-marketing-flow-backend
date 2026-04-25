import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const listBranchesQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  city: z.string().trim().min(1).optional(),
  includeInactive: booleanFromString.default(false),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
