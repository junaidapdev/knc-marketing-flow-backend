import { z } from 'zod';

const CONTENT_TYPES = [
  'snap_story',
  'snap_spotlight',
  'tiktok_video',
  'ig_video',
  'ig_story',
  'shoot',
  'engagement',
  'research',
] as const;

const CADENCES = ['daily', 'weekly', 'monthly', 'custom'] as const;

const SHOOT_MODES = ['shoot_daily', 'shoot_weekly_post_daily', 'none'] as const;

const MIN_DAY = 0;
const MAX_DAY = 6;
const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 2000;
const MAX_DAYS_OF_WEEK = 7;

export const createRecurringTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    brandId: z.string().uuid(),
    contentType: z.enum(CONTENT_TYPES),
    cadence: z.enum(CADENCES),
    daysOfWeek: z.array(z.number().int().min(MIN_DAY).max(MAX_DAY)).max(MAX_DAYS_OF_WEEK).nullish(),
    defaultAssigneeId: z.string().uuid(),
    shootMode: z.enum(SHOOT_MODES).default('none'),
    notes: z.string().max(MAX_NOTES_LENGTH).nullish(),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (
      (v.cadence === 'weekly' || v.cadence === 'custom') &&
      (!v.daysOfWeek || v.daysOfWeek.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysOfWeek'],
        message: `daysOfWeek is required for cadence "${v.cadence}"`,
      });
    }
  });

export const updateRecurringTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    contentType: z.enum(CONTENT_TYPES),
    cadence: z.enum(CADENCES),
    daysOfWeek: z
      .array(z.number().int().min(MIN_DAY).max(MAX_DAY))
      .max(MAX_DAYS_OF_WEEK)
      .nullable(),
    defaultAssigneeId: z.string().uuid(),
    shootMode: z.enum(SHOOT_MODES),
    notes: z.string().max(MAX_NOTES_LENGTH).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  });

export const applyTemplatesSchema = z.object({
  templateIds: z.array(z.string().uuid()).min(1),
});

export type CreateRecurringTemplateInput = z.infer<typeof createRecurringTemplateSchema>;
export type UpdateRecurringTemplateInput = z.infer<typeof updateRecurringTemplateSchema>;
export type ApplyTemplatesInput = z.infer<typeof applyTemplatesSchema>;
