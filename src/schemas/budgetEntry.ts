import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CATEGORIES = [
  'general_marketing',
  'influencers',
  'in_shop_activities',
  'product_offers',
  'camera_production',
] as const;

const LINKED_ENTITY_TYPES = ['calendar_entry', 'offer', 'shop_activity'] as const;

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;

const dateString = z.string().regex(ISO_DATE, { message: 'Expected YYYY-MM-DD' });

export const createBudgetEntrySchema = z.object({
  planId: z.string().uuid(),
  category: z.enum(CATEGORIES),
  amountSar: z.number().nonnegative().finite(),
  date: dateString,
  description: z.string().max(MAX_DESCRIPTION_LENGTH).nullish(),
  branchId: z.string().uuid().nullish(),
  linkedEntityType: z.enum(LINKED_ENTITY_TYPES).nullish(),
  linkedEntityId: z.string().uuid().nullish(),
  receiptUrl: z.string().url().max(MAX_URL_LENGTH).nullish(),
});

export const updateBudgetEntrySchema = z
  .object({
    category: z.enum(CATEGORIES),
    amountSar: z.number().nonnegative().finite(),
    date: dateString,
    description: z.string().max(MAX_DESCRIPTION_LENGTH).nullable(),
    branchId: z.string().uuid().nullable(),
    linkedEntityType: z.enum(LINKED_ENTITY_TYPES).nullable(),
    linkedEntityId: z.string().uuid().nullable(),
    receiptUrl: z.string().url().max(MAX_URL_LENGTH).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listBudgetEntriesQuerySchema = z.object({
  planId: z.string().uuid().optional(),
  category: z.enum(CATEGORIES).optional(),
  branchId: z.string().uuid().optional(),
});

export const budgetDashboardQuerySchema = z.object({
  planId: z.string().uuid(),
});

export type CreateBudgetEntryInput = z.infer<typeof createBudgetEntrySchema>;
export type UpdateBudgetEntryInput = z.infer<typeof updateBudgetEntrySchema>;
export type ListBudgetEntriesQuery = z.infer<typeof listBudgetEntriesQuerySchema>;
export type BudgetDashboardQuery = z.infer<typeof budgetDashboardQuerySchema>;
