import { z } from 'zod';
import { createCalendarEntrySchema } from './calendarEntry';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_MONTH = 1;
const MAX_MONTH = 12;

export const planStatusSchema = z.enum(['draft', 'published']);

export const createPlanSchema = z.object({
  month: z.number().int().min(MIN_MONTH).max(MAX_MONTH),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  budgetCeiling: z.number().nonnegative().finite().nullish(),
  entries: z.array(createCalendarEntrySchema).optional(),
});

export const updatePlanSchema = z
  .object({
    budgetCeiling: z.number().nonnegative().finite().nullable(),
    status: planStatusSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
