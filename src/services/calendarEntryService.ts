import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type {
  CreateCalendarEntryInput,
  ListCalendarEntriesQuery,
  UpdateCalendarEntryInput,
} from '../schemas/calendarEntry';
import type { Json, TableRow, TableUpdate } from '../types/database';
import type { CalendarEntry } from '../types/domain/calendarEntry';
import { toCalendarEntry } from './calendarEntryMapper';
import { assertPlanCoversDate } from './planService';
import { buildTaskChain } from './taskChainBuilder';
import { resolveAssigneesByRole } from './taskService';

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

export async function listPlanEntries(
  planId: string,
  filters: ListCalendarEntriesQuery,
): Promise<CalendarEntry[]> {
  let q = db.from(TABLES.CALENDAR_ENTRY).select('*').eq('plan_id', planId).order('date');
  if (filters.date) q = q.eq('date', filters.date);
  if (filters.brandId) q = q.eq('brand_id', filters.brandId);
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.status) q = q.eq('status', filters.status);

  const { data, error } = await q;
  if (error) throw dbError(error);
  return (data ?? []).map(toCalendarEntry);
}

export async function createPlanEntry(
  planId: string,
  input: CreateCalendarEntryInput,
): Promise<CalendarEntry> {
  await assertPlanCoversDate(planId, input.date);

  const assigneesByRole = await resolveAssigneesByRole();
  const tasks = buildTaskChain({
    entryType: input.type,
    entryDate: input.date,
    assigneesByRole,
  });

  const entryPayload = {
    plan_id: planId,
    brand_id: input.brandId,
    date: input.date,
    type: input.type,
    platform: input.platform ?? null,
    title: input.title,
    script: input.script ?? null,
    notes: input.notes ?? null,
    status: input.status,
    template_id: input.templateId ?? null,
  };

  const taskPayload = tasks.map((t) => ({
    assignee_id: t.assigneeId,
    due_date: t.dueDate,
    step: t.step,
    status: 'pending',
  }));

  const { data, error } = await db.rpc('create_entry_with_tasks', {
    p_entry: entryPayload as unknown as Json,
    p_tasks: taskPayload as unknown as Json,
  });
  if (error) throw dbError(error);
  return toCalendarEntry(data as unknown as TableRow<'calendar_entry'>);
}

export async function getEntry(id: string): Promise<CalendarEntry> {
  const { data, error } = await db
    .from(TABLES.CALENDAR_ENTRY)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.ENTRY_NOT_FOUND.code, ERRORS.ENTRY_NOT_FOUND.message);
  }
  return toCalendarEntry(data);
}

export async function updateEntry(
  id: string,
  patch: UpdateCalendarEntryInput,
): Promise<CalendarEntry> {
  const current = await getEntry(id);

  if (patch.date !== undefined && patch.date !== current.date) {
    await assertPlanCoversDate(current.planId, patch.date);
  }

  const update: TableUpdate<'calendar_entry'> = {};
  if (patch.brandId !== undefined) update.brand_id = patch.brandId;
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.platform !== undefined) update.platform = patch.platform ?? null;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.script !== undefined) update.script = patch.script ?? null;
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.templateId !== undefined) update.template_id = patch.templateId ?? null;

  const { data, error } = await db
    .from(TABLES.CALENDAR_ENTRY)
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw dbError(error);
  return toCalendarEntry(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await db
    .from(TABLES.CALENDAR_ENTRY)
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (fetchError) throw dbError(fetchError);
  if (!existing) {
    throw new HttpError(NOT_FOUND, ERRORS.ENTRY_NOT_FOUND.code, ERRORS.ENTRY_NOT_FOUND.message);
  }

  const { error } = await db.from(TABLES.CALENDAR_ENTRY).delete().eq('id', id);
  if (error) throw dbError(error);
}
