import { z } from 'zod';

const ENTRY_TYPES = [
  'snap_story',
  'snap_spotlight',
  'tiktok_video',
  'ig_video',
  'ig_story',
  'shop_activity',
  'offer',
  'shoot',
  'engagement',
  'research',
] as const;

const ENTRY_STATUSES = ['planned', 'in_progress', 'ready', 'posted'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_PLATFORM_LENGTH = 32;
const MAX_TITLE_LENGTH = 200;
const MAX_SCRIPT_LENGTH = 5000;
const MAX_NOTES_LENGTH = 2000;

export const calendarEntryDateSchema = z
  .string()
  .regex(ISO_DATE, { message: 'Expected YYYY-MM-DD' });

export const createCalendarEntrySchema = z.object({
  brandId: z.string().uuid(),
  date: calendarEntryDateSchema,
  type: z.enum(ENTRY_TYPES),
  platform: z.string().trim().min(1).max(MAX_PLATFORM_LENGTH).nullish(),
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  script: z.string().max(MAX_SCRIPT_LENGTH).nullish(),
  notes: z.string().max(MAX_NOTES_LENGTH).nullish(),
  status: z.enum(ENTRY_STATUSES).default('planned'),
  templateId: z.string().uuid().nullish(),
});

export const updateCalendarEntrySchema = createCalendarEntrySchema.partial().strict();

export const listCalendarEntriesQuerySchema = z.object({
  date: calendarEntryDateSchema.optional(),
  brandId: z.string().uuid().optional(),
  type: z.enum(ENTRY_TYPES).optional(),
  status: z.enum(ENTRY_STATUSES).optional(),
});

export type CreateCalendarEntryInput = z.infer<typeof createCalendarEntrySchema>;
export type UpdateCalendarEntryInput = z.infer<typeof updateCalendarEntrySchema>;
export type ListCalendarEntriesQuery = z.infer<typeof listCalendarEntriesQuerySchema>;
