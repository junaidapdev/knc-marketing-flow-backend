export type TaskStep = 'script' | 'shoot' | 'edit' | 'post' | 'setup' | 'execute';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface Task {
  id: string;
  calendarEntryId: string | null;
  offerId: string | null;
  shopActivityId: string | null;
  assigneeId: string;
  dueDate: string;
  step: TaskStep;
  status: TaskStatus;
  notes: string | null;
  sharedShootId: string | null;
  createdAt: string;
}
