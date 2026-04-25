import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authGetUserMock,
  queueResults,
  resetSupabaseMocks,
  rpcCalls,
  setRpcResult,
} from './helpers/supabaseMock';
import { buildApp } from '../src/app';
import { clearAssigneeRoleCache } from '../src/services/taskService';

const TOKEN = 'valid.jwt';
const PLAN_ID = '11111111-1111-1111-1111-111111111111';
const BRAND_ID = '22222222-2222-2222-2222-222222222222';
const BRANCH_A = '33333333-3333-3333-3333-333333333333';
const BRANCH_B = '44444444-4444-4444-4444-444444444444';
const CONTENT_ID = '55555555-5555-5555-5555-555555555555';
const PRODUCTION_ID = '66666666-6666-6666-6666-666666666666';

const TPL_SNAP_DAILY = 'aaaa0001-0000-0000-0000-000000000001';
const TPL_WEEKLY_TIKTOK = 'aaaa0002-0000-0000-0000-000000000002';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${TOKEN}` });

const ASSIGNEE_ROWS = [
  {
    id: CONTENT_ID,
    name: 'Ammar',
    role: 'content_engagement',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: PRODUCTION_ID,
    name: 'Junaid',
    role: 'digital_marketing_production',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const TEMPLATE_ROWS = [
  {
    id: TPL_SNAP_DAILY,
    name: 'Daily Snapchat Story',
    brand_id: BRAND_ID,
    content_type: 'snap_story',
    cadence: 'daily',
    days_of_week: null,
    default_assignee_id: CONTENT_ID,
    shoot_mode: 'shoot_weekly_post_daily',
    notes: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: TPL_WEEKLY_TIKTOK,
    name: 'Weekly TikTok',
    brand_id: BRAND_ID,
    content_type: 'tiktok_video',
    cadence: 'weekly',
    days_of_week: [3],
    default_assignee_id: CONTENT_ID,
    shoot_mode: 'none',
    notes: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function resetAll(): void {
  resetSupabaseMocks();
  clearAssigneeRoleCache();
  authenticate();
}

describe('POST /plans/wizard', () => {
  beforeEach(resetAll);

  it('creates a complete plan (entries + tasks + offers + activities) atomically', async () => {
    queueResults(
      { data: ASSIGNEE_ROWS, error: null }, // resolveAssigneesByRole
      { data: TEMPLATE_ROWS, error: null }, // templates .in()
    );
    setRpcResult({
      data: {
        planId: PLAN_ID,
        entriesCreated: 35,
        tasksCreated: 60,
        offersCreated: 3,
        shopActivitiesCreated: 4,
        sharedShootsCreated: 5,
      },
      error: null,
    });

    const res = await request(buildApp())
      .post('/plans/wizard')
      .set(headers())
      .send({
        month: 4,
        year: 2026,
        budgetCeiling: 10000,
        applyTemplateIds: [TPL_SNAP_DAILY, TPL_WEEKLY_TIKTOK],
        offers: [
          {
            brandId: BRAND_ID,
            name: 'Ramadan Bundle',
            type: 'bundle',
            branchIds: [BRANCH_A],
            startDate: '2026-04-10',
            endDate: '2026-04-20',
          },
          {
            brandId: BRAND_ID,
            name: 'Threshold 50 SAR',
            type: 'threshold_coupon',
            branchIds: [BRANCH_A, BRANCH_B],
            startDate: '2026-04-12',
            endDate: '2026-04-15',
          },
          {
            brandId: BRAND_ID,
            name: 'Salary Week Promo',
            type: 'salary_week',
            branchIds: [],
            startDate: '2026-04-25',
            endDate: '2026-04-28',
          },
        ],
        shopActivities: [
          { branchId: BRANCH_A, weekOf: '2026-04-05', type: 'sampling' },
          { branchId: BRANCH_A, weekOf: '2026-04-12', type: 'display_change' },
          { branchId: BRANCH_B, weekOf: '2026-04-19', type: 'tasting' },
          { branchId: BRANCH_B, weekOf: '2026-04-26', type: 'promotion_setup' },
        ],
        status: 'draft',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      planId: PLAN_ID,
      entriesCreated: 35,
      tasksCreated: 60,
      offersCreated: 3,
      shopActivitiesCreated: 4,
    });

    const call = rpcCalls()[0];
    expect(call?.fn).toBe('create_plan_from_wizard');
    const args = call?.args as {
      p_plan: { month: number; year: number };
      p_offers: unknown[];
      p_shop_activities: unknown[];
      p_entries: unknown[];
      p_shared_shoots: unknown[];
    };
    expect(args.p_plan.month).toBe(4);
    expect(args.p_plan.year).toBe(2026);
    expect(args.p_offers).toHaveLength(3);
    expect(args.p_shop_activities).toHaveLength(4);
    // 30 daily Snapchat + 5 weekly TikTok = 35 entries
    expect(args.p_entries).toHaveLength(35);
    // 5 weekly shoots for the Snapchat daily mode
    expect(args.p_shared_shoots).toHaveLength(5);
  });

  it('each offer gets a setup task dated startDate − 1', async () => {
    queueResults({ data: ASSIGNEE_ROWS, error: null });
    setRpcResult({
      data: {
        planId: PLAN_ID,
        entriesCreated: 0,
        tasksCreated: 1,
        offersCreated: 1,
        shopActivitiesCreated: 0,
        sharedShootsCreated: 0,
      },
      error: null,
    });

    await request(buildApp())
      .post('/plans/wizard')
      .set(headers())
      .send({
        month: 4,
        year: 2026,
        offers: [
          {
            brandId: BRAND_ID,
            name: 'Ramadan Bundle',
            type: 'bundle',
            branchIds: [BRANCH_A],
            startDate: '2026-04-10',
            endDate: '2026-04-20',
          },
        ],
      });

    const args = rpcCalls()[0]?.args as {
      p_offers: Array<{
        task: { step: string; due_date: string; assignee_id: string };
      }>;
    };
    expect(args.p_offers[0]?.task).toEqual({
      step: 'setup',
      due_date: '2026-04-09',
      assignee_id: PRODUCTION_ID,
      status: 'pending',
    });
  });

  it('returns 404 when a requested template id is missing', async () => {
    queueResults(
      { data: ASSIGNEE_ROWS, error: null },
      { data: [], error: null }, // templates lookup comes back empty
    );

    const res = await request(buildApp())
      .post('/plans/wizard')
      .set(headers())
      .send({
        month: 4,
        year: 2026,
        applyTemplateIds: [TPL_SNAP_DAILY],
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('422 when an offer has endDate < startDate', async () => {
    queueResults({ data: ASSIGNEE_ROWS, error: null });

    const res = await request(buildApp())
      .post('/plans/wizard')
      .set(headers())
      .send({
        month: 4,
        year: 2026,
        offers: [
          {
            brandId: BRAND_ID,
            name: 'Backward',
            type: 'bundle',
            branchIds: [],
            startDate: '2026-04-20',
            endDate: '2026-04-10',
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });
});

describe('PATCH /plans/:id/wizard-draft', () => {
  beforeEach(resetAll);

  it('persists draft state on an existing plan', async () => {
    const draft = {
      month: 4,
      year: 2026,
      applyTemplateIds: [TPL_SNAP_DAILY],
      step: 3,
    };
    queueResults({
      data: { id: PLAN_ID, wizard_draft: draft },
      error: null,
    });

    const res = await request(buildApp())
      .patch(`/plans/${PLAN_ID}/wizard-draft`)
      .set(headers())
      .send(draft);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ planId: PLAN_ID, draft });
  });

  it('404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp())
      .patch(`/plans/${PLAN_ID}/wizard-draft`)
      .set(headers())
      .send({ month: 4 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });

  it('rejects unknown keys in the draft', async () => {
    const res = await request(buildApp())
      .patch(`/plans/${PLAN_ID}/wizard-draft`)
      .set(headers())
      .send({ foo: 'bar' });
    expect(res.status).toBe(422);
  });
});

describe('GET /plans/:id/wizard-draft', () => {
  beforeEach(resetAll);

  it('returns the stored draft', async () => {
    const draft = { month: 4, year: 2026, step: 2 };
    queueResults({
      data: { id: PLAN_ID, wizard_draft: draft },
      error: null,
    });

    const res = await request(buildApp()).get(`/plans/${PLAN_ID}/wizard-draft`).set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ planId: PLAN_ID, draft });
  });
});
