import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const OFFER_TYPES = [
  'threshold_coupon',
  'branch_deal',
  'single_product',
  'salary_week',
  'bundle',
] as const;

const OFFER_STATUSES = ['planned', 'live', 'ended'] as const;

const MAX_NAME_LENGTH = 200;
const MAX_TEXT_LENGTH = 5000;
const MAX_BRANCH_IDS = 20;

const dateString = z.string().regex(ISO_DATE, { message: 'Expected YYYY-MM-DD' });

export const createOfferSchema = z
  .object({
    planId: z.string().uuid(),
    brandId: z.string().uuid(),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    type: z.enum(OFFER_TYPES),
    branchIds: z.array(z.string().uuid()).max(MAX_BRANCH_IDS).default([]),
    startDate: dateString,
    endDate: dateString,
    productsText: z.string().max(MAX_TEXT_LENGTH).nullish(),
    mechanicText: z.string().max(MAX_TEXT_LENGTH).nullish(),
    budgetAmount: z.number().nonnegative().finite().nullish(),
    assigneeId: z.string().uuid().optional(),
    status: z.enum(OFFER_STATUSES).default('planned'),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'endDate must be on or after startDate',
  });

export const updateOfferSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    type: z.enum(OFFER_TYPES),
    branchIds: z.array(z.string().uuid()).max(MAX_BRANCH_IDS),
    startDate: dateString,
    endDate: dateString,
    productsText: z.string().max(MAX_TEXT_LENGTH).nullable(),
    mechanicText: z.string().max(MAX_TEXT_LENGTH).nullable(),
    budgetAmount: z.number().nonnegative().finite().nullable(),
    assigneeId: z.string().uuid(),
    status: z.enum(OFFER_STATUSES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listOffersQuerySchema = z.object({
  planId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  status: z.enum(OFFER_STATUSES).optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;
