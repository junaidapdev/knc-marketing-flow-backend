import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND, UNPROCESSABLE } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { WizardDraftInput, WizardSubmitInput } from '../schemas/wizard';
import type { Json, TableRow } from '../types/database';
import type { Plan, PlanStatus } from '../types/domain/plan';
import type { RecurringTemplate } from '../types/domain/recurringTemplate';
import {
  buildApplyPlanForTemplate,
  mergeApplyPlans,
  type ApplyPlan,
  type PlannedEntryPayload,
  type PlannedSharedShoot,
} from './templateApplicator';
import { resolveAssigneesByRole } from './taskService';

type TemplateRow = TableRow<'recurring_template'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

const ONE_DAY_MS = 86_400_000;
const DATE_PAD_LENGTH = 2;

function pad(n: number): string {
  return String(n).padStart(DATE_PAD_LENGTH, '0');
}

function dayBefore(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d) - ONE_DAY_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

interface OfferPayload {
  brand_id: string;
  name: string;
  type: string;
  branch_ids: string[];
  start_date: string;
  end_date: string;
  products_text: string | null;
  mechanic_text: string | null;
  budget_amount: number | null;
  assignee_id: string;
  status: string;
  task: {
    assignee_id: string;
    due_date: string;
    step: 'setup';
    status: 'pending';
  };
}

interface ShopActivityPayload {
  branch_id: string;
  week_of: string;
  type: string;
  assignee_id: string;
  status: string;
  photo_url: string | null;
  notes: string | null;
  task: {
    assignee_id: string;
    due_date: string;
    step: 'execute';
    status: 'pending';
  };
}

export interface WizardSummary {
  planId: string;
  entriesCreated: number;
  tasksCreated: number;
  offersCreated: number;
  shopActivitiesCreated: number;
  sharedShootsCreated: number;
}

export async function submitWizard(input: WizardSubmitInput): Promise<WizardSummary> {
  // Resolve role-based defaults once.
  const assigneesByRole = await resolveAssigneesByRole();
  const defaultProduction = assigneesByRole.digital_marketing_production;

  // ---- 1. Templates → entries + shared shoots ----
  let applyPlan: ApplyPlan = { sharedShoots: [], entries: [] };
  if (input.applyTemplateIds.length > 0) {
    const { data: rows, error } = await db
      .from(TABLES.RECURRING_TEMPLATE)
      .select('*')
      .in('id', input.applyTemplateIds);
    if (error) throw dbError(error);

    const foundIds = new Set((rows ?? []).map((r: TemplateRow) => r.id));
    const missing = input.applyTemplateIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new HttpError(
        NOT_FOUND,
        ERRORS.TEMPLATE_NOT_FOUND.code,
        ERRORS.TEMPLATE_NOT_FOUND.message,
        { missing },
      );
    }

    const plan: Plan = {
      id: 'pending',
      month: input.month,
      year: input.year,
      budgetCeiling: input.budgetCeiling ?? null,
      status: input.status,
      createdAt: new Date().toISOString(),
    };

    const perTemplate = (rows ?? []).map((row: TemplateRow) =>
      buildApplyPlanForTemplate({
        plan,
        assigneesByRole,
        template: {
          id: row.id,
          name: row.name,
          brandId: row.brand_id,
          contentType: row.content_type as RecurringTemplate['contentType'],
          cadence: row.cadence,
          daysOfWeek: row.days_of_week,
          defaultAssigneeId: row.default_assignee_id,
          shootMode: row.shoot_mode ?? 'none',
          notes: row.notes,
          isActive: row.is_active,
          createdAt: row.created_at,
        },
      }),
    );
    applyPlan = mergeApplyPlans(perTemplate);
  }

  // ---- 2. Offers (+ setup tasks) ----
  const offerPayloads: OfferPayload[] = input.offers.map((o) => {
    if (o.endDate < o.startDate) {
      throw new HttpError(
        UNPROCESSABLE,
        ERRORS.INVALID_DATE_RANGE.code,
        ERRORS.INVALID_DATE_RANGE.message,
      );
    }
    const assigneeId = o.assigneeId ?? defaultProduction;
    return {
      brand_id: o.brandId,
      name: o.name,
      type: o.type,
      branch_ids: o.branchIds,
      start_date: o.startDate,
      end_date: o.endDate,
      products_text: o.productsText ?? null,
      mechanic_text: o.mechanicText ?? null,
      budget_amount: o.budgetAmount ?? null,
      assignee_id: assigneeId,
      status: o.status,
      task: {
        assignee_id: assigneeId,
        due_date: dayBefore(o.startDate),
        step: 'setup',
        status: 'pending',
      },
    };
  });

  // ---- 3. Shop activities (+ execute tasks) ----
  const shopActivityPayloads: ShopActivityPayload[] = input.shopActivities.map((a) => {
    const assigneeId = a.assigneeId ?? defaultProduction;
    return {
      branch_id: a.branchId,
      week_of: a.weekOf,
      type: a.type,
      assignee_id: assigneeId,
      status: a.status,
      photo_url: a.photoUrl ?? null,
      notes: a.notes ?? null,
      task: {
        assignee_id: assigneeId,
        due_date: a.weekOf,
        step: 'execute',
        status: 'pending',
      },
    };
  });

  // ---- 4. One atomic RPC ----
  const planPayload = {
    month: input.month,
    year: input.year,
    budget_ceiling: input.budgetCeiling ?? null,
    status: input.status,
  };

  const { data, error } = await db.rpc('create_plan_from_wizard', {
    p_plan: planPayload as unknown as Json,
    p_shared_shoots: applyPlan.sharedShoots as unknown as Json,
    p_entries: applyPlan.entries as unknown as Json,
    p_offers: offerPayloads as unknown as Json,
    p_shop_activities: shopActivityPayloads as unknown as Json,
  });
  if (error) throw dbError(error);

  const summary = data as unknown as WizardSummary;
  return {
    planId: summary.planId,
    entriesCreated: summary.entriesCreated ?? 0,
    tasksCreated: summary.tasksCreated ?? 0,
    offersCreated: summary.offersCreated ?? 0,
    shopActivitiesCreated: summary.shopActivitiesCreated ?? 0,
    sharedShootsCreated: summary.sharedShootsCreated ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

export interface WizardDraftRecord {
  planId: string;
  draft: WizardDraftInput | null;
}

export async function saveWizardDraft(
  planId: string,
  draft: WizardDraftInput,
): Promise<WizardDraftRecord> {
  const { data, error } = await db
    .from(TABLES.PLAN)
    .update({ wizard_draft: draft as unknown as Json })
    .eq('id', planId)
    .select('id, wizard_draft')
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  return {
    planId: (data as { id: string }).id,
    draft: (data as { wizard_draft: WizardDraftInput | null }).wizard_draft,
  };
}

export async function clearWizardDraft(planId: string): Promise<void> {
  const { error } = await db.from(TABLES.PLAN).update({ wizard_draft: null }).eq('id', planId);
  if (error) throw dbError(error);
}

export async function getWizardDraft(planId: string): Promise<WizardDraftRecord> {
  const { data, error } = await db
    .from(TABLES.PLAN)
    .select('id, wizard_draft')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  return {
    planId: (data as { id: string }).id,
    draft: (data as { wizard_draft: WizardDraftInput | null }).wizard_draft,
  };
}

// Exported helpers for status transitions (clears draft on publish)
export async function clearDraftIfPublished(planId: string, status: PlanStatus): Promise<void> {
  if (status === 'published') {
    await clearWizardDraft(planId);
  }
}

// Re-export payload types for tests
export type { OfferPayload, ShopActivityPayload, PlannedSharedShoot, PlannedEntryPayload };
