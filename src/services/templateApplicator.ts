import { TASK_CHAIN_BY_ENTRY_TYPE } from '../constants/taskDefaults';
import type { AssigneeRole } from '../types/domain/assignee';
import type { Plan } from '../types/domain/plan';
import type { RecurringTemplate } from '../types/domain/recurringTemplate';
import type { TaskStep } from '../types/domain/task';

const MS_PER_DAY = 86_400_000;
const DATE_PAD_LENGTH = 2;

export interface PlannedTaskPayload {
  step: TaskStep;
  assignee_id: string;
  due_date: string;
  shared_shoot_tmp_id?: string;
}

export interface PlannedEntryPayload {
  brand_id: string;
  date: string;
  type: RecurringTemplate['contentType'];
  title: string;
  notes?: string | null;
  template_id: string;
  tasks: PlannedTaskPayload[];
}

export interface PlannedSharedShoot {
  tmp_id: string;
  assignee_id: string;
  due_date: string;
}

export interface ApplyPlan {
  sharedShoots: PlannedSharedShoot[];
  entries: PlannedEntryPayload[];
}

function pad(n: number): string {
  return String(n).padStart(DATE_PAD_LENGTH, '0');
}

function iso(year: number, monthIdx0: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIdx0, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  const base = Date.UTC(y, m - 1, d);
  const shifted = new Date(base + days * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function lastDayOfMonth(year: number, month1: number): number {
  // month1 is 1-12; pass it as the 0-based index to get day 0 of the
  // next month — which is the last day of the target month.
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function weekSundayIso(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  return addDays(dateIso, -dow);
}

/**
 * Compute the list of in-plan-month dates that satisfy the template's
 * cadence rule. `daysOfWeek` uses 0=Sun..6=Sat.
 */
export function datesForTemplate(template: RecurringTemplate, plan: Plan): string[] {
  const last = lastDayOfMonth(plan.year, plan.month);
  const dates: string[] = [];

  switch (template.cadence) {
    case 'daily': {
      for (let d = 1; d <= last; d++) dates.push(iso(plan.year, plan.month - 1, d));
      break;
    }
    case 'weekly':
    case 'custom': {
      const allowed = new Set(template.daysOfWeek ?? []);
      for (let d = 1; d <= last; d++) {
        const dateIso = iso(plan.year, plan.month - 1, d);
        const dow = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
        if (allowed.has(dow)) dates.push(dateIso);
      }
      break;
    }
    case 'monthly': {
      dates.push(iso(plan.year, plan.month - 1, 1));
      break;
    }
  }
  return dates;
}

function firstInPlan(plan: Plan): string {
  return iso(plan.year, plan.month - 1, 1);
}

function lastInPlan(plan: Plan): string {
  return iso(plan.year, plan.month - 1, lastDayOfMonth(plan.year, plan.month));
}

function clampToPlan(dateIso: string, plan: Plan): string {
  if (dateIso < firstInPlan(plan)) return firstInPlan(plan);
  if (dateIso > lastInPlan(plan)) return lastInPlan(plan);
  return dateIso;
}

interface BuildInput {
  template: RecurringTemplate;
  plan: Plan;
  assigneesByRole: Readonly<Record<AssigneeRole, string>>;
}

/**
 * Pure builder: translates a single template + plan into the payload for
 * `apply_templates_to_plan`. Emits shared shoot tasks (for the Snapchat
 * "shoot weekly, post daily" mode) separately from per-day entries so
 * the RPC can insert them in dependency order.
 */
export function buildApplyPlanForTemplate(input: BuildInput): ApplyPlan {
  const { template, plan, assigneesByRole } = input;
  const dates = datesForTemplate(template, plan);

  if (template.shootMode === 'shoot_weekly_post_daily') {
    return buildShootWeeklyPostDaily({ template, plan, dates, assigneesByRole });
  }

  const chain = TASK_CHAIN_BY_ENTRY_TYPE[template.contentType];
  const entries: PlannedEntryPayload[] = dates.map((date) => ({
    brand_id: template.brandId,
    date,
    type: template.contentType,
    title: template.name,
    template_id: template.id,
    tasks: chain.map((step) => ({
      step: step.step,
      assignee_id: assigneesByRole[step.role],
      due_date: addDays(date, step.offsetDays),
    })),
  }));

  return { sharedShoots: [], entries };
}

interface WeeklyShootBuildInput {
  template: RecurringTemplate;
  plan: Plan;
  dates: string[];
  assigneesByRole: Readonly<Record<AssigneeRole, string>>;
}

function buildShootWeeklyPostDaily(input: WeeklyShootBuildInput): ApplyPlan {
  const { template, plan, dates, assigneesByRole } = input;
  const productionId = assigneesByRole.digital_marketing_production;
  const contentId = assigneesByRole.content_engagement;

  const sharedShoots: PlannedSharedShoot[] = [];
  const tmpIdByWeek = new Map<string, string>();

  for (const date of dates) {
    const sunday = weekSundayIso(date);
    if (tmpIdByWeek.has(sunday)) continue;
    const tmpId = `shoot-${sunday}`;
    tmpIdByWeek.set(sunday, tmpId);
    sharedShoots.push({
      tmp_id: tmpId,
      assignee_id: productionId,
      due_date: clampToPlan(sunday, plan),
    });
  }

  const entries: PlannedEntryPayload[] = dates.map((date) => ({
    brand_id: template.brandId,
    date,
    type: template.contentType,
    title: template.name,
    template_id: template.id,
    tasks: [
      {
        step: 'post',
        assignee_id: contentId,
        due_date: date,
        shared_shoot_tmp_id: tmpIdByWeek.get(weekSundayIso(date)),
      },
    ],
  }));

  return { sharedShoots, entries };
}

/**
 * Merge the per-template `ApplyPlan` results into a single payload for
 * one RPC call.
 */
export function mergeApplyPlans(plans: ApplyPlan[]): ApplyPlan {
  return {
    sharedShoots: plans.flatMap((p) => p.sharedShoots),
    entries: plans.flatMap((p) => p.entries),
  };
}
