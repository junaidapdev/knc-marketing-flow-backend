import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type {
  CreateBudgetEntryInput,
  ListBudgetEntriesQuery,
  UpdateBudgetEntryInput,
} from '../schemas/budgetEntry';
import type { TableRow, TableUpdate } from '../types/database';
import type { BudgetCategory, BudgetDashboard, BudgetEntry } from '../types/domain/budgetEntry';

type BudgetRow = TableRow<'budget_entry'>;
type PlanRow = TableRow<'plan'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toBudgetEntry(row: BudgetRow): BudgetEntry {
  return {
    id: row.id,
    planId: row.plan_id,
    category: row.category,
    amountSar: Number(row.amount_sar),
    date: row.date,
    description: row.description,
    branchId: row.branch_id,
    linkedEntityType: row.linked_entity_type,
    linkedEntityId: row.linked_entity_id,
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
  };
}

export async function listBudgetEntries(filters: ListBudgetEntriesQuery): Promise<BudgetEntry[]> {
  let q = db.from(TABLES.BUDGET_ENTRY).select('*').order('date');
  if (filters.planId) q = q.eq('plan_id', filters.planId);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.branchId) q = q.eq('branch_id', filters.branchId);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as BudgetRow[]).map(toBudgetEntry);
}

export async function getBudgetEntry(id: string): Promise<BudgetEntry> {
  const { data, error } = await db.from(TABLES.BUDGET_ENTRY).select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.code,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.message,
    );
  }
  return toBudgetEntry(data as BudgetRow);
}

export async function createBudgetEntry(input: CreateBudgetEntryInput): Promise<BudgetEntry> {
  const { data, error } = await db
    .from(TABLES.BUDGET_ENTRY)
    .insert({
      plan_id: input.planId,
      category: input.category,
      amount_sar: input.amountSar,
      date: input.date,
      description: input.description ?? null,
      branch_id: input.branchId ?? null,
      linked_entity_type: input.linkedEntityType ?? null,
      linked_entity_id: input.linkedEntityId ?? null,
      receipt_url: input.receiptUrl ?? null,
    })
    .select('*')
    .single();
  if (error) throw dbError(error);
  return toBudgetEntry(data as BudgetRow);
}

export async function updateBudgetEntry(
  id: string,
  patch: UpdateBudgetEntryInput,
): Promise<BudgetEntry> {
  const update: TableUpdate<'budget_entry'> = {};
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.amountSar !== undefined) update.amount_sar = patch.amountSar;
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.branchId !== undefined) update.branch_id = patch.branchId;
  if (patch.linkedEntityType !== undefined) update.linked_entity_type = patch.linkedEntityType;
  if (patch.linkedEntityId !== undefined) update.linked_entity_id = patch.linkedEntityId;
  if (patch.receiptUrl !== undefined) update.receipt_url = patch.receiptUrl;

  const { data, error } = await db
    .from(TABLES.BUDGET_ENTRY)
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.code,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.message,
    );
  }
  return toBudgetEntry(data as BudgetRow);
}

export async function deleteBudgetEntry(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.BUDGET_ENTRY)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.code,
      ERRORS.BUDGET_ENTRY_NOT_FOUND.message,
    );
  }
  const { error } = await db.from(TABLES.BUDGET_ENTRY).delete().eq('id', id);
  if (error) throw dbError(error);
}

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

const CATEGORY_KEYS: readonly BudgetCategory[] = [
  'general_marketing',
  'influencers',
  'in_shop_activities',
  'product_offers',
  'camera_production',
];

function emptyByCategory(): Record<BudgetCategory, number> {
  const out = {} as Record<BudgetCategory, number>;
  for (const key of CATEGORY_KEYS) out[key] = 0;
  return out;
}

const PERCENT = 100;
const FULL_YEAR = 12;

export interface BudgetAggregationRow {
  amount_sar: number | string;
  category: BudgetCategory;
}

/**
 * Pure aggregator — easy to unit-test in isolation from Supabase. Given the
 * raw rows for a plan and (optionally) the rows for the preceding month,
 * plus the plan's budget ceiling, return the dashboard envelope.
 */
export function aggregateBudget(
  rows: BudgetAggregationRow[],
  previousMonthRows: BudgetAggregationRow[] | null,
  ceiling: number | null,
): BudgetDashboard {
  const byCategory = emptyByCategory();
  let totalSpent = 0;
  for (const r of rows) {
    const amount = Number(r.amount_sar);
    totalSpent += amount;
    byCategory[r.category] += amount;
  }

  let vsLastMonth: BudgetDashboard['vsLastMonth'] = null;
  if (previousMonthRows) {
    const prevTotal = previousMonthRows.reduce((acc, r) => acc + Number(r.amount_sar), 0);
    const deltaPercent = prevTotal === 0 ? 0 : ((totalSpent - prevTotal) / prevTotal) * PERCENT;
    vsLastMonth = { total: prevTotal, deltaPercent };
  }

  const ceilingUsedPercent =
    ceiling === null || ceiling === 0 ? null : (totalSpent / ceiling) * PERCENT;

  return { totalSpent, byCategory, vsLastMonth, ceilingUsedPercent };
}

export async function getBudgetDashboard(planId: string): Promise<BudgetDashboard> {
  // Load the plan (for ceiling + previous-month lookup)
  const { data: planRow, error: planErr } = await db
    .from(TABLES.PLAN)
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (planErr) throw dbError(planErr);
  if (!planRow) {
    throw new HttpError(NOT_FOUND, ERRORS.PLAN_NOT_FOUND.code, ERRORS.PLAN_NOT_FOUND.message);
  }
  const plan = planRow as PlanRow;

  // Current plan's budget rows
  const { data: currentRows, error: currentErr } = await db
    .from(TABLES.BUDGET_ENTRY)
    .select('amount_sar, category')
    .eq('plan_id', planId);
  if (currentErr) throw dbError(currentErr);

  // Previous month's plan, if it exists
  const prevMonth = plan.month === 1 ? FULL_YEAR : plan.month - 1;
  const prevYear = plan.month === 1 ? plan.year - 1 : plan.year;

  const { data: prevPlan, error: prevPlanErr } = await db
    .from(TABLES.PLAN)
    .select('id')
    .eq('month', prevMonth)
    .eq('year', prevYear)
    .maybeSingle();
  if (prevPlanErr) throw dbError(prevPlanErr);

  let previousMonthRows: BudgetAggregationRow[] | null = null;
  if (prevPlan?.id) {
    const { data: prevRows, error: prevRowsErr } = await db
      .from(TABLES.BUDGET_ENTRY)
      .select('amount_sar, category')
      .eq('plan_id', prevPlan.id);
    if (prevRowsErr) throw dbError(prevRowsErr);
    previousMonthRows = (prevRows ?? []) as BudgetAggregationRow[];
  }

  return aggregateBudget(
    (currentRows ?? []) as BudgetAggregationRow[],
    previousMonthRows,
    plan.budget_ceiling === null ? null : Number(plan.budget_ceiling),
  );
}
