import type { AssigneeRole } from '../types/domain/assignee';
import type { CalendarEntryType } from '../types/domain/calendarEntry';
import type { TaskStep } from '../types/domain/task';
import { TASK_CHAIN_BY_ENTRY_TYPE } from '../constants/taskDefaults';

const MS_PER_DAY = 86_400_000;
const DATE_PAD_LENGTH = 2;

export interface TaskChainInput {
  entryType: CalendarEntryType;
  entryDate: string;
  assigneesByRole: Readonly<Record<AssigneeRole, string>>;
  /**
   * When true, the caller (Chunk 6) will handle shared-shoot/daily-post
   * bundling itself. For now we bail with an empty chain so the RPC
   * inserts the entry without a misleading auto-chain.
   */
  shootWeeklyPostDaily?: boolean;
}

export interface PlannedTask {
  step: TaskStep;
  dueDate: string;
  assigneeId: string;
}

function addDays(isoDate: string, days: number): string {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const base = Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr));
  const shifted = new Date(base + days * MS_PER_DAY);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(DATE_PAD_LENGTH, '0');
  const d = String(shifted.getUTCDate()).padStart(DATE_PAD_LENGTH, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Pure builder: given an entry's type + date and a role-to-assignee map,
 * return the list of tasks that should accompany it.
 *
 * Returns [] for entry types that produce no tasks (shop_activity, offer)
 * or when the entry is part of a `shoot_weekly_post_daily` template — the
 * recurring-template service (Chunk 6) owns that case and will bundle
 * shared-shoot + daily-post tasks itself.
 */
export function buildTaskChain(input: TaskChainInput): PlannedTask[] {
  // TODO(chunk-6): honor shoot_weekly_post_daily by delegating to the
  // recurring-template scheduler instead of emitting a standard chain.
  if (input.shootWeeklyPostDaily) return [];

  const chain = TASK_CHAIN_BY_ENTRY_TYPE[input.entryType];
  return chain.map((step) => ({
    step: step.step,
    dueDate: addDays(input.entryDate, step.offsetDays),
    assigneeId: input.assigneesByRole[step.role],
  }));
}
