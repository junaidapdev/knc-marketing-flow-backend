import { z } from 'zod';

const MAX_KEY_LENGTH = 500;

export const updateSettingsSchema = z
  .object({
    claudeApiKey: z.string().trim().max(MAX_KEY_LENGTH).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
