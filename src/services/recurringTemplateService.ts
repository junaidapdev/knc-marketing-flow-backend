import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Json, TableRow, TableUpdate } from '../types/database';
import type { RecurringTemplate } from '../types/domain/recurringTemplate';
import type {
  ApplyTemplatesInput,
  CreateRecurringTemplateInput,
  UpdateRecurringTemplateInput,
} from '../schemas/recurringTemplate';
import { getPlan } from './planService';
import { buildApplyPlanForTemplate, mergeApplyPlans, type ApplyPlan } from './templateApplicator';
import { resolveAssigneesByRole } from './taskService';

type TemplateRow = TableRow<'recurring_template'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toTemplate(row: TemplateRow): RecurringTemplate {
  return {
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
  };
}

export async function listTemplates(includeInactive = false): Promise<RecurringTemplate[]> {
  let q = db.from(TABLES.RECURRING_TEMPLATE).select('*').order('name');
  if (!includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as TemplateRow[]).map(toTemplate);
}

export async function getTemplate(id: string): Promise<RecurringTemplate> {
  const { data, error } = await db
    .from(TABLES.RECURRING_TEMPLATE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.TEMPLATE_NOT_FOUND.code,
      ERRORS.TEMPLATE_NOT_FOUND.message,
    );
  }
  return toTemplate(data as TemplateRow);
}

export async function createTemplate(
  input: CreateRecurringTemplateInput,
): Promise<RecurringTemplate> {
  const { data, error } = await db
    .from(TABLES.RECURRING_TEMPLATE)
    .insert({
      name: input.name,
      brand_id: input.brandId,
      content_type: input.contentType,
      cadence: input.cadence,
      days_of_week: input.daysOfWeek ?? null,
      default_assignee_id: input.defaultAssigneeId,
      shoot_mode: input.shootMode,
      notes: input.notes ?? null,
      is_active: input.isActive,
    })
    .select('*')
    .single();
  if (error) throw dbError(error);
  return toTemplate(data as TemplateRow);
}

export async function updateTemplate(
  id: string,
  patch: UpdateRecurringTemplateInput,
): Promise<RecurringTemplate> {
  const update: TableUpdate<'recurring_template'> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.contentType !== undefined) update.content_type = patch.contentType;
  if (patch.cadence !== undefined) update.cadence = patch.cadence;
  if (patch.daysOfWeek !== undefined) update.days_of_week = patch.daysOfWeek;
  if (patch.defaultAssigneeId !== undefined) update.default_assignee_id = patch.defaultAssigneeId;
  if (patch.shootMode !== undefined) update.shoot_mode = patch.shootMode;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;

  const { data, error } = await db
    .from(TABLES.RECURRING_TEMPLATE)
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.TEMPLATE_NOT_FOUND.code,
      ERRORS.TEMPLATE_NOT_FOUND.message,
    );
  }
  return toTemplate(data as TemplateRow);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.RECURRING_TEMPLATE)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.TEMPLATE_NOT_FOUND.code,
      ERRORS.TEMPLATE_NOT_FOUND.message,
    );
  }
  const { error } = await db.from(TABLES.RECURRING_TEMPLATE).delete().eq('id', id);
  if (error) throw dbError(error);
}

export interface ApplyTemplatesSummary {
  entryCount: number;
  taskCount: number;
  sharedShootCount: number;
}

export async function applyTemplatesToPlan(
  planId: string,
  input: ApplyTemplatesInput,
): Promise<ApplyTemplatesSummary> {
  const plan = await getPlan(planId);

  const { data: rows, error } = await db
    .from(TABLES.RECURRING_TEMPLATE)
    .select('*')
    .in('id', input.templateIds);
  if (error) throw dbError(error);

  const templates = ((rows ?? []) as TemplateRow[]).map(toTemplate);
  const missing = input.templateIds.filter((id) => !templates.some((t) => t.id === id));
  if (missing.length > 0) {
    throw new HttpError(
      NOT_FOUND,
      ERRORS.TEMPLATE_NOT_FOUND.code,
      ERRORS.TEMPLATE_NOT_FOUND.message,
      { missing },
    );
  }

  const assigneesByRole = await resolveAssigneesByRole();

  const perTemplate: ApplyPlan[] = templates.map((tmpl) =>
    buildApplyPlanForTemplate({ template: tmpl, plan, assigneesByRole }),
  );
  const merged = mergeApplyPlans(perTemplate);

  const { data: result, error: rpcError } = await db.rpc('apply_templates_to_plan', {
    p_plan_id: planId,
    p_shared_shoots: merged.sharedShoots as unknown as Json,
    p_entries: merged.entries as unknown as Json,
  });
  if (rpcError) throw dbError(rpcError);

  const summary = result as unknown as ApplyTemplatesSummary;
  return {
    entryCount: summary.entryCount ?? 0,
    taskCount: summary.taskCount ?? 0,
    sharedShootCount: summary.sharedShootCount ?? 0,
  };
}
