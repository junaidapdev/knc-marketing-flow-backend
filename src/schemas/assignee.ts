import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const listAssigneesQuerySchema = z.object({
  includeInactive: booleanFromString.default(false),
});

export type ListAssigneesQuery = z.infer<typeof listAssigneesQuerySchema>;
