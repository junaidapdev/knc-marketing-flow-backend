import { z } from 'zod';
import { planStatusSchema } from './plan';
import { createOfferSchema } from './offer';
import { createShopActivitySchema } from './shopActivity';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const MIN_MONTH = 1;
const MAX_MONTH = 12;

/**
 * Wizard input. `applyTemplateIds` is resolved on the server via the
 * template applicator; `offers` and `shopActivities` are validated against
 * the existing create schemas but without `planId` (the wizard creates the
 * plan in the same transaction).
 */
const wizardOfferSchema = createOfferSchema.innerType().omit({ planId: true });
const wizardShopActivitySchema = createShopActivitySchema.omit({ planId: true });

export const wizardSubmitSchema = z.object({
  month: z.number().int().min(MIN_MONTH).max(MAX_MONTH),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  budgetCeiling: z.number().nonnegative().finite().nullish(),
  applyTemplateIds: z.array(z.string().uuid()).default([]),
  offers: z.array(wizardOfferSchema).default([]),
  shopActivities: z.array(wizardShopActivitySchema).default([]),
  status: planStatusSchema.default('draft'),
});

/**
 * Draft persistence schema. All fields optional so the UI can save partial
 * state as the user fills in the wizard. Keys match the final submit shape
 * so promotion to a real submit is a spread.
 */
export const wizardDraftSchema = z
  .object({
    month: z.number().int().min(MIN_MONTH).max(MAX_MONTH),
    year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
    budgetCeiling: z.number().nonnegative().finite().nullable(),
    applyTemplateIds: z.array(z.string().uuid()),
    offers: z.array(z.unknown()),
    shopActivities: z.array(z.unknown()),
    status: planStatusSchema,
    step: z.number().int().min(1).max(MAX_MONTH).optional(),
  })
  .partial()
  .strict();

export type WizardSubmitInput = z.infer<typeof wizardSubmitSchema>;
export type WizardDraftInput = z.infer<typeof wizardDraftSchema>;
