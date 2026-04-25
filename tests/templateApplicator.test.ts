import { describe, expect, it } from 'vitest';
import {
  buildApplyPlanForTemplate,
  datesForTemplate,
  mergeApplyPlans,
} from '../src/services/templateApplicator';
import type { Plan } from '../src/types/domain/plan';
import type { RecurringTemplate } from '../src/types/domain/recurringTemplate';

const BRAND_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTENT_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCTION_ID = '22222222-2222-2222-2222-222222222222';

const ASSIGNEES = {
  content_engagement: CONTENT_ID,
  digital_marketing_production: PRODUCTION_ID,
} as const;

// April 2026 — Apr 1 is a Wednesday (day 3), last day is 30.
const PLAN_APR_2026: Plan = {
  id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
  month: 4,
  year: 2026,
  budgetCeiling: null,
  status: 'draft',
  createdAt: '2026-04-01T00:00:00Z',
};

function baseTemplate(overrides: Partial<RecurringTemplate>): RecurringTemplate {
  return {
    id: 'tttttttt-tttt-tttt-tttt-tttttttttttt',
    name: 'Test Template',
    brandId: BRAND_ID,
    contentType: 'snap_story',
    cadence: 'daily',
    daysOfWeek: null,
    defaultAssigneeId: CONTENT_ID,
    shootMode: 'none',
    notes: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('datesForTemplate', () => {
  it('daily cadence returns every day of the plan month (30 for April 2026)', () => {
    const dates = datesForTemplate(baseTemplate({ cadence: 'daily' }), PLAN_APR_2026);
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2026-04-01');
    expect(dates[29]).toBe('2026-04-30');
  });

  it('weekly cadence on Wednesday returns 5 dates in April 2026', () => {
    const dates = datesForTemplate(
      baseTemplate({ cadence: 'weekly', daysOfWeek: [3] }),
      PLAN_APR_2026,
    );
    // Wednesdays in April 2026: 1, 8, 15, 22, 29
    expect(dates).toEqual(['2026-04-01', '2026-04-08', '2026-04-15', '2026-04-22', '2026-04-29']);
  });

  it('custom cadence with [0,2,4] returns Sun/Tue/Thu of April 2026', () => {
    const dates = datesForTemplate(
      baseTemplate({ cadence: 'custom', daysOfWeek: [0, 2, 4] }),
      PLAN_APR_2026,
    );
    // Sun:  5, 12, 19, 26
    // Tue:  7, 14, 21, 28
    // Thu:  2, 9, 16, 23, 30
    expect(dates).toEqual([
      '2026-04-02',
      '2026-04-05',
      '2026-04-07',
      '2026-04-09',
      '2026-04-12',
      '2026-04-14',
      '2026-04-16',
      '2026-04-19',
      '2026-04-21',
      '2026-04-23',
      '2026-04-26',
      '2026-04-28',
      '2026-04-30',
    ]);
  });

  it('monthly cadence returns only the 1st of the plan month', () => {
    const dates = datesForTemplate(baseTemplate({ cadence: 'monthly' }), PLAN_APR_2026);
    expect(dates).toEqual(['2026-04-01']);
  });
});

describe('buildApplyPlanForTemplate — standard mode', () => {
  it('weekly TikTok generates ~4 entries each with a 4-task chain', () => {
    const plan = buildApplyPlanForTemplate({
      plan: PLAN_APR_2026,
      template: baseTemplate({
        cadence: 'weekly',
        contentType: 'tiktok_video',
        daysOfWeek: [3], // Wed
      }),
      assigneesByRole: ASSIGNEES,
    });

    expect(plan.sharedShoots).toEqual([]);
    expect(plan.entries).toHaveLength(5); // Wednesdays in April 2026

    const firstEntry = plan.entries[0];
    expect(firstEntry?.date).toBe('2026-04-01');
    expect(firstEntry?.type).toBe('tiktok_video');
    expect(firstEntry?.tasks).toEqual([
      { step: 'script', assignee_id: CONTENT_ID, due_date: '2026-03-29' },
      { step: 'shoot', assignee_id: PRODUCTION_ID, due_date: '2026-03-30' },
      { step: 'edit', assignee_id: PRODUCTION_ID, due_date: '2026-03-31' },
      { step: 'post', assignee_id: PRODUCTION_ID, due_date: '2026-04-01' },
    ]);
  });

  it('engagement template emits a single execute task per day', () => {
    const plan = buildApplyPlanForTemplate({
      plan: PLAN_APR_2026,
      template: baseTemplate({
        contentType: 'engagement',
        cadence: 'daily',
      }),
      assigneesByRole: ASSIGNEES,
    });

    expect(plan.entries).toHaveLength(30);
    for (const entry of plan.entries) {
      expect(entry.tasks).toEqual([
        { step: 'execute', assignee_id: CONTENT_ID, due_date: entry.date },
      ]);
    }
  });
});

describe('buildApplyPlanForTemplate — shoot_weekly_post_daily', () => {
  it('generates 5 weekly shoots + 30 daily post entries for April 2026', () => {
    const plan = buildApplyPlanForTemplate({
      plan: PLAN_APR_2026,
      template: baseTemplate({
        contentType: 'snap_story',
        cadence: 'daily',
        shootMode: 'shoot_weekly_post_daily',
      }),
      assigneesByRole: ASSIGNEES,
    });

    // April 2026 weeks: Sun Mar 29–Apr 4, Apr 5–11, Apr 12–18, Apr 19–25, Apr 26–May 2
    expect(plan.sharedShoots).toHaveLength(5);
    expect(plan.entries).toHaveLength(30);

    // Sunday of the first week is Mar 29 — before the plan month, so clamped to Apr 1.
    expect(plan.sharedShoots[0]?.due_date).toBe('2026-04-01');
    expect(plan.sharedShoots[1]?.due_date).toBe('2026-04-05');
    expect(plan.sharedShoots[4]?.due_date).toBe('2026-04-26');

    // All shoots assigned to the production role.
    for (const shoot of plan.sharedShoots) {
      expect(shoot.assignee_id).toBe(PRODUCTION_ID);
    }

    // Every entry has exactly one post task linked to its week's shoot.
    const shootIdForSunday = new Map(plan.sharedShoots.map((s) => [s.due_date, s.tmp_id]));
    // First entry (Apr 1): shoot due-date was clamped to Apr 1, so the
    // map key for that week is Apr 1 itself.
    expect(plan.entries[0]?.tasks).toEqual([
      {
        step: 'post',
        assignee_id: CONTENT_ID,
        due_date: '2026-04-01',
        shared_shoot_tmp_id: shootIdForSunday.get('2026-04-01'),
      },
    ]);
  });
});

describe('mergeApplyPlans', () => {
  it('concatenates sharedShoots and entries across per-template plans', () => {
    const a = buildApplyPlanForTemplate({
      plan: PLAN_APR_2026,
      template: baseTemplate({ cadence: 'monthly' }),
      assigneesByRole: ASSIGNEES,
    });
    const b = buildApplyPlanForTemplate({
      plan: PLAN_APR_2026,
      template: baseTemplate({
        cadence: 'weekly',
        contentType: 'tiktok_video',
        daysOfWeek: [3],
      }),
      assigneesByRole: ASSIGNEES,
    });
    const merged = mergeApplyPlans([a, b]);
    expect(merged.entries.length).toBe(a.entries.length + b.entries.length);
    expect(merged.sharedShoots).toEqual([]);
  });
});
