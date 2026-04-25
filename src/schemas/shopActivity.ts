import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const ACTIVITY_TYPES = [
  'sampling',
  'display_change',
  'tasting',
  'promotion_setup',
  'other',
] as const;

const ACTIVITY_STATUSES = ['planned', 'in_progress', 'completed'] as const;

const MAX_NOTES_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

const dateString = z.string().regex(ISO_DATE, { message: 'Expected YYYY-MM-DD' });

export const createShopActivitySchema = z.object({
  planId: z.string().uuid(),
  branchId: z.string().uuid(),
  weekOf: dateString,
  type: z.enum(ACTIVITY_TYPES),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(ACTIVITY_STATUSES).default('planned'),
  photoUrl: z.string().url().max(MAX_URL_LENGTH).nullish(),
  notes: z.string().max(MAX_NOTES_LENGTH).nullish(),
});

export const updateShopActivitySchema = z
  .object({
    branchId: z.string().uuid(),
    weekOf: dateString,
    type: z.enum(ACTIVITY_TYPES),
    assigneeId: z.string().uuid(),
    status: z.enum(ACTIVITY_STATUSES),
    photoUrl: z.string().url().max(MAX_URL_LENGTH).nullable(),
    notes: z.string().max(MAX_NOTES_LENGTH).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listShopActivitiesQuerySchema = z.object({
  planId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
});

export const photoUploadUrlSchema = z.object({
  contentType: z
    .string()
    .regex(/^[\w.+-]+\/[\w.+-]+$/)
    .default('image/jpeg'),
});

export type CreateShopActivityInput = z.infer<typeof createShopActivitySchema>;
export type UpdateShopActivityInput = z.infer<typeof updateShopActivitySchema>;
export type ListShopActivitiesQuery = z.infer<typeof listShopActivitiesQuerySchema>;
export type PhotoUploadUrlInput = z.infer<typeof photoUploadUrlSchema>;
