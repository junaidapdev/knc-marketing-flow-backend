import { ERRORS } from '../constants/errors';
import { INTERNAL, NOT_FOUND, UNPROCESSABLE } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { TASK_STATUS_TRANSITIONS } from '../constants/taskDefaults';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { TableRow, TableUpdate } from '../types/database';
import type { AssigneeRole } from '../types/domain/assignee';
import type { Task, TaskStatus } from '../types/domain/task';
import type { ListTasksQuery, UpdateTaskInput } from '../schemas/task';

type TaskRow = TableRow<'task'>;
type AssigneeRow = TableRow<'assignee'>;

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    calendarEntryId: row.calendar_entry_id,
    offerId: row.offer_id,
    shopActivityId: row.shop_activity_id,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    step: row.step,
    status: row.status,
    notes: row.notes,
    sharedShootId: row.shared_shoot_id,
    createdAt: row.created_at,
  };
}

/**
 * Resolve the first active assignee per role. Result is cached in-process
 * — assignees change rarely and we accept a short staleness window.
 */
const CACHE_MINUTES = 5;
const MS_PER_MINUTE = 60_000;
const ROLE_CACHE_TTL_MS = CACHE_MINUTES * MS_PER_MINUTE;
const DATE_PAD_LENGTH = 2;
interface RoleCache {
  fetchedAt: number;
  byRole: Record<AssigneeRole, string>;
}
let roleCache: RoleCache | null = null;

export function clearAssigneeRoleCache(): void {
  roleCache = null;
}

export async function resolveAssigneesByRole(): Promise<Record<AssigneeRole, string>> {
  if (roleCache && Date.now() - roleCache.fetchedAt < ROLE_CACHE_TTL_MS) {
    return roleCache.byRole;
  }

  const { data, error } = await db
    .from(TABLES.ASSIGNEE)
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  if (error) throw dbError(error);

  const byRole: Partial<Record<AssigneeRole, string>> = {};
  for (const row of (data ?? []) as AssigneeRow[]) {
    if (byRole[row.role] === undefined) {
      byRole[row.role] = row.id;
    }
  }

  const contentId = byRole.content_engagement;
  const productionId = byRole.digital_marketing_production;
  if (!contentId || !productionId) {
    throw new HttpError(
      INTERNAL,
      ERRORS.ROLE_ASSIGNEE_MISSING.code,
      ERRORS.ROLE_ASSIGNEE_MISSING.message,
    );
  }

  const resolved: Record<AssigneeRole, string> = {
    content_engagement: contentId,
    digital_marketing_production: productionId,
  };
  roleCache = { fetchedAt: Date.now(), byRole: resolved };
  return resolved;
}

export async function listTasks(filters: ListTasksQuery): Promise<Task[]> {
  let q = db.from(TABLES.TASK).select('*').order('due_date');
  if (filters.assigneeId) q = q.eq('assignee_id', filters.assigneeId);
  if (filters.dueDate) q = q.eq('due_date', filters.dueDate);
  if (filters.status) q = q.eq('status', filters.status);
  // plan_id filter cannot be expressed directly on task; resolve via the
  // parent calendar_entry. For simplicity: when planId is requested, we
  // fetch the entry ids first and filter tasks by them.
  if (filters.planId) {
    const { data: entryRows, error: entryErr } = await db
      .from(TABLES.CALENDAR_ENTRY)
      .select('id')
      .eq('plan_id', filters.planId);
    if (entryErr) throw dbError(entryErr);
    const ids = (entryRows ?? []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return [];
    q = q.in('calendar_entry_id', ids);
  }

  const { data, error } = await q;
  if (error) throw dbError(error);
  return ((data ?? []) as TaskRow[]).map(toTask);
}

export async function getTask(id: string): Promise<Task> {
  const { data, error } = await db.from(TABLES.TASK).select('*').eq('id', id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    throw new HttpError(NOT_FOUND, ERRORS.TASK_NOT_FOUND.code, ERRORS.TASK_NOT_FOUND.message);
  }
  return toTask(data as TaskRow);
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(DATE_PAD_LENGTH, '0');
  const d = String(now.getUTCDate()).padStart(DATE_PAD_LENGTH, '0');
  return `${y}-${m}-${d}`;
}

export async function listTasksDueToday(now: Date = new Date()): Promise<Record<string, Task[]>> {
  const today = todayIso(now);
  const tasks = await listTasks({ dueDate: today });
  const grouped: Record<string, Task[]> = {};
  for (const task of tasks) {
    const bucket = grouped[task.assigneeId] ?? [];
    bucket.push(task);
    grouped[task.assigneeId] = bucket;
  }
  return grouped;
}

function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (from === to) return;
  const allowed = TASK_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new HttpError(
      UNPROCESSABLE,
      ERRORS.INVALID_TASK_TRANSITION.code,
      ERRORS.INVALID_TASK_TRANSITION.message,
      { from, to },
    );
  }
}

export async function updateTaskStatus(id: string, input: UpdateTaskInput): Promise<Task> {
  const current = await getTask(id);

  if (input.status !== undefined) {
    assertTransition(current.status, input.status);
  }

  const patch: TableUpdate<'task'> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await db
    .from(TABLES.TASK)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw dbError(error);
  return toTask(data as TaskRow);
}

export async function listTasksForEntry(entryId: string): Promise<Task[]> {
  const { data, error } = await db
    .from(TABLES.TASK)
    .select('*')
    .eq('calendar_entry_id', entryId)
    .order('due_date');
  if (error) throw dbError(error);
  return ((data ?? []) as TaskRow[]).map(toTask);
}

export { toTask };
