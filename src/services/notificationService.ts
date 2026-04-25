import { ERRORS } from '../constants/errors';
import { INTERNAL } from '../constants/httpStatus';
import { TABLES } from '../constants/tables';
import { db } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { TableRow } from '../types/database';
import type { Task } from '../types/domain/task';
import { todayIso } from './taskService';

type TaskRow = TableRow<'task'>;

const RECENT_ACTIVITY_LOOKBACK_HOURS = 24;
const MS_PER_HOUR = 3_600_000;
const RECENT_LIMIT = 20;

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

function dbError(error: { message?: string } | null | undefined): HttpError {
  return new HttpError(INTERNAL, ERRORS.DB_ERROR.code, ERRORS.DB_ERROR.message, {
    cause: error?.message,
  });
}

export interface NotificationFeed {
  overdue: Task[];
  dueToday: Task[];
  recent: Task[];
  counts: {
    overdue: number;
    dueToday: number;
    recent: number;
    total: number;
  };
}

export async function getNotifications(now: Date = new Date()): Promise<NotificationFeed> {
  const today = todayIso(now);
  const since = new Date(
    now.getTime() - RECENT_ACTIVITY_LOOKBACK_HOURS * MS_PER_HOUR,
  ).toISOString();

  // Three small queries. Could be collapsed into a single RPC later; we
  // keep them separate here so each list is individually paginatable when
  // the V2 design demands it.
  const overdueQuery = await db
    .from(TABLES.TASK)
    .select('*')
    .eq('status', 'pending')
    .lt('due_date', today)
    .order('due_date');

  if (overdueQuery.error) throw dbError(overdueQuery.error);

  const todayQuery = await db
    .from(TABLES.TASK)
    .select('*')
    .eq('status', 'pending')
    .eq('due_date', today)
    .order('due_date');

  if (todayQuery.error) throw dbError(todayQuery.error);

  const recentQuery = await db
    .from(TABLES.TASK)
    .select('*')
    .in('status', ['done', 'skipped'])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(RECENT_LIMIT);

  if (recentQuery.error) throw dbError(recentQuery.error);

  const overdue = ((overdueQuery.data ?? []) as TaskRow[]).map(toTask);
  const dueToday = ((todayQuery.data ?? []) as TaskRow[]).map(toTask);
  const recent = ((recentQuery.data ?? []) as TaskRow[]).map(toTask);

  return {
    overdue,
    dueToday,
    recent,
    counts: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      recent: recent.length,
      total: overdue.length + dueToday.length,
    },
  };
}
