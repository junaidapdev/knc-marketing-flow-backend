import { ERRORS } from '../constants/errors';
import { CONFLICT, INTERNAL, NOT_FOUND, UNPROCESSABLE } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Json, TableRow, TableUpdate } from '../types/database';
import type { Plan, PlanStatus, PlanWithEntryCount } from '../types/domain/plan';
import type { CreateCalendarEntryInput } from '../schemas/calendarEntry';

type PlanRow = TableRow<'plan'>;

const UNIQUE_VIOLATION = '23505';
const INVALID_PARAMETER = '22023';

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    budgetCeiling: row.budget_ceiling,
    status: row.status,
    createdAt: row.created_at,
  };
}

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await db
    .from(TABLES.PLAN)
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(toPlan);
}

export async function getPlan(id: string): Promise<PlanWithEntryCount> {
  const { data, error } = await db.from(TABLES.PLAN).select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }

  const { count, error: countError } = await db
    .from(TABLES.CALENDAR_ENTRY)
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', id);
  if (countError) throw dbError(countError);

  return { ...toPlan(data), entryCount: count ?? 0 };
}

export interface CreatePlanArgs {
  month: number;
  year: number;
  budgetCeiling?: number | null;
  entries?: CreateCalendarEntryInput[];
}

export async function createPlan(args: CreatePlanArgs): Promise<Plan> {
  const entries = args.entries ?? [];

  if (entries.length > 0) {
    return createPlanWithEntries(args);
  }

  const { data, error } = await db
    .from(TABLES.PLAN)
    .insert({
      month: args.month,
      year: args.year,
      budget_ceiling: args.budgetCeiling ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new HttpError(
        CONFLICT,
        ERRORS.PLAN_DUPLICATE_MONTH.code,
        ERRORS.PLAN_DUPLICATE_MONTH.message,
      );
    }
    throw dbError(error);
  }
  return toPlan(data);
}

async function createPlanWithEntries(args: CreatePlanArgs): Promise<Plan> {
  const entries = (args.entries ?? []).map((e) => ({
    brand_id: e.brandId,
    date: e.date,
    type: e.type,
    platform: e.platform ?? null,
    title: e.title,
    script: e.script ?? null,
    notes: e.notes ?? null,
    status: e.status,
    template_id: e.templateId ?? null,
  }));

  const { data: planId, error } = await db.rpc('create_plan_with_entries', {
    p_month: args.month,
    p_year: args.year,
    p_budget_ceiling: args.budgetCeiling ?? null,
    p_entries: entries as unknown as Json,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new HttpError(
        CONFLICT,
        ERRORS.PLAN_DUPLICATE_MONTH.code,
        ERRORS.PLAN_DUPLICATE_MONTH.message,
      );
    }
    if (error.code === INVALID_PARAMETER) {
      throw new HttpError(
        UNPROCESSABLE,
        ERRORS.ENTRY_DATE_OUT_OF_PLAN.code,
        ERRORS.ENTRY_DATE_OUT_OF_PLAN.message,
      );
    }
    throw dbError(error);
  }

  const fetched = await db.from(TABLES.PLAN).select('*').eq('id', planId).single();
  if (fetched.error) throw dbError(fetched.error);
  return toPlan(fetched.data);
}

export interface UpdatePlanArgs {
  budgetCeiling?: number | null;
  status?: PlanStatus;
}

export async function updatePlan(id: string, args: UpdatePlanArgs): Promise<Plan> {
  const patch: TableUpdate<'plan'> = {};
  if (args.budgetCeiling !== undefined) patch.budget_ceiling = args.budgetCeiling;
  if (args.status !== undefined) patch.status = args.status;
  // Clear any saved wizard draft once the plan moves to published.
  if (args.status === 'published') patch.wizard_draft = null;

  const { data, error } = await db
    .from(TABLES.PLAN)
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  return toPlan(data);
}

export async function deletePlan(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.PLAN)
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  if (existing.status !== 'draft') {
    throw new HttpError(
      CONFLICT,
      ERRORS.PLAN_ALREADY_PUBLISHED.code,
      ERRORS.PLAN_ALREADY_PUBLISHED.message,
    );
  }

  const { error } = await db.from(TABLES.PLAN).delete().eq('id', id);
  if (error) throw dbError(error);
}

export async function assertPlanCoversDate(planId: string, date: string): Promise<Plan> {
  const { data, error } = await db.from(TABLES.PLAN).select('*').eq('id', planId).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  const plan = toPlan(data);

  const [yearStr, monthStr] = date.split('-');
  const entryYear = Number(yearStr);
  const entryMonth = Number(monthStr);
  if (entryYear !== plan.year || entryMonth !== plan.month) {
    throw new HttpError(
      UNPROCESSABLE,
      ERRORS.ENTRY_DATE_OUT_OF_PLAN.code,
      ERRORS.ENTRY_DATE_OUT_OF_PLAN.message,
    );
  }
  return plan;
}
