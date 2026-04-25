import type { AssigneeRole } from '../types/domain/assignee';
import type { CalendarEntryType } from '../types/domain/calendarEntry';
import type { TaskStep } from '../types/domain/task';

export interface TaskChainStep {
  step: TaskStep;
  role: AssigneeRole;
  offsetDays: number;
}

const VIDEO_CHAIN: readonly TaskChainStep[] = [
  { step: 'script', role: 'content_engagement', offsetDays: -3 },
  { step: 'shoot', role: 'digital_marketing_production', offsetDays: -2 },
  { step: 'edit', role: 'digital_marketing_production', offsetDays: -1 },
  { step: 'post', role: 'digital_marketing_production', offsetDays: 0 },
] as const;

const STORY_CHAIN: readonly TaskChainStep[] = [
  { step: 'post', role: 'content_engagement', offsetDays: 0 },
] as const;

const SHOOT_CHAIN: readonly TaskChainStep[] = [
  { step: 'shoot', role: 'digital_marketing_production', offsetDays: 0 },
] as const;

const EXECUTE_CHAIN: readonly TaskChainStep[] = [
  { step: 'execute', role: 'content_engagement', offsetDays: 0 },
] as const;

export const TASK_CHAIN_BY_ENTRY_TYPE: Readonly<
  Record<CalendarEntryType, readonly TaskChainStep[]>
> = Object.freeze({
  tiktok_video: VIDEO_CHAIN,
  ig_video: VIDEO_CHAIN,
  snap_spotlight: VIDEO_CHAIN,
  snap_story: STORY_CHAIN,
  ig_story: STORY_CHAIN,
  shoot: SHOOT_CHAIN,
  engagement: EXECUTE_CHAIN,
  research: EXECUTE_CHAIN,
  // shop_activity and offer entries are handled by their own modules
  // (Chunks 7 and 8). No tasks generated from the calendar entry.
  shop_activity: [],
  offer: [],
});

/**
 * Allowed status transitions, enforced in the service layer.
 *   pending     → in_progress | skipped
 *   in_progress → done | skipped
 *   done        → (terminal)
 *   skipped     → pending (allow un-skip)
 */
import type { TaskStatus } from '../types/domain/task';

export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> =
  Object.freeze({
    pending: ['in_progress', 'skipped'],
    in_progress: ['done', 'skipped'],
    done: [],
    skipped: ['pending'],
  });
