import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authGetUserMock,
  queueResults,
  resetSupabaseMocks,
  rpcCalls,
  rpcMock,
  setRpcResult,
} from './helpers/supabaseMock';
import { buildApp } from '../src/app';
import { clearAssigneeRoleCache } from '../src/services/taskService';

const TOKEN = 'valid.jwt';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const BRAND_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTENT_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCTION_ID = '22222222-2222-2222-2222-222222222222';

const TPL_SNAP_DAILY = 'aaaa0001-0000-0000-0000-000000000001';
const TPL_WEEKLY_TIKTOK = 'aaaa0002-0000-0000-0000-000000000002';
const TPL_IG_STORIES = 'aaaa0003-0000-0000-0000-000000000003';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

function templateRow(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

const PLAN_ROW_APR_2026 = {
  id: PLAN_ID,
  month: 4,
  year: 2026,
  budget_ceiling: null,
  status: 'draft',
  created_at: '2026-04-01T00:00:00Z',
};

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

function resetAll(): void {
  resetSupabaseMocks();
  clearAssigneeRoleCache();
  authenticate();
}

describe('GET /templates', () => {
  beforeEach(resetAll);

  it('returns active templates mapped to domain shape', async () => {
    queueResults({
      data: [templateRow({}), templateRow({ id: TPL_WEEKLY_TIKTOK, name: 'Weekly TikTok' })],
      error: null,
    });

    const res = await request(buildApp()).get('/templates').set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      id: TPL_SNAP_DAILY,
      shootMode: 'shoot_weekly_post_daily',
    });
  });

  it('401 without a token', async () => {
    const res = await request(buildApp()).get('/templates');
    expect(res.status).toBe(401);
  });
});

describe('POST /templates', () => {
  beforeEach(resetAll);

  it('creates a template (201)', async () => {
    queueResults({ data: templateRow({}), error: null });

    const res = await request(buildApp()).post('/templates').set(headers()).send({
      name: 'Daily Snapchat Story',
      brandId: BRAND_ID,
      contentType: 'snap_story',
      cadence: 'daily',
      defaultAssigneeId: CONTENT_ID,
      shootMode: 'shoot_weekly_post_daily',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Daily Snapchat Story');
  });

  it('422 when weekly cadence has no daysOfWeek', async () => {
    const res = await request(buildApp()).post('/templates').set(headers()).send({
      name: 'Weekly TikTok',
      brandId: BRAND_ID,
      contentType: 'tiktok_video',
      cadence: 'weekly',
      defaultAssigneeId: CONTENT_ID,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('PATCH /templates/:id', () => {
  beforeEach(resetAll);

  it('updates and returns 200', async () => {
    queueResults({ data: templateRow({ is_active: false }), error: null });

    const res = await request(buildApp())
      .patch(`/templates/${TPL_SNAP_DAILY}`)
      .set(headers())
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('404 when the template is missing', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp())
      .patch(`/templates/${TPL_SNAP_DAILY}`)
      .set(headers())
      .send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('DELETE /templates/:id', () => {
  beforeEach(resetAll);

  it('deletes an existing template (204)', async () => {
    queueResults({ data: { id: TPL_SNAP_DAILY }, error: null }, { data: null, error: null });
    const res = await request(buildApp()).delete(`/templates/${TPL_SNAP_DAILY}`).set(headers());
    expect(res.status).toBe(204);
  });

  it('404 when the template does not exist', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp()).delete(`/templates/${TPL_SNAP_DAILY}`).set(headers());
    expect(res.status).toBe(404);
  });
});

describe('POST /plans/:planId/apply-templates', () => {
  beforeEach(resetAll);

  it('applies multiple templates atomically via the RPC', async () => {
    queueResults(
      { data: PLAN_ROW_APR_2026, error: null }, // getPlan: plan row
      { data: null, error: null, count: 0 }, // getPlan: entry count head query
      {
        data: [
          templateRow({ id: TPL_SNAP_DAILY }),
          templateRow({
            id: TPL_WEEKLY_TIKTOK,
            name: 'Weekly TikTok',
            content_type: 'tiktok_video',
            cadence: 'weekly',
            days_of_week: [3],
            shoot_mode: 'none',
          }),
          templateRow({
            id: TPL_IG_STORIES,
            name: 'IG Stories',
            content_type: 'ig_story',
            cadence: 'custom',
            days_of_week: [0, 2, 4],
            shoot_mode: 'none',
          }),
        ],
        error: null,
      }, // templates lookup
      { data: ASSIGNEE_ROWS, error: null }, // assignees
    );
    setRpcResult({
      data: { entryCount: 48, taskCount: 80, sharedShootCount: 5 },
      error: null,
    });

    const res = await request(buildApp())
      .post(`/plans/${PLAN_ID}/apply-templates`)
      .set(headers())
      .send({
        templateIds: [TPL_SNAP_DAILY, TPL_WEEKLY_TIKTOK, TPL_IG_STORIES],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      entryCount: 48,
      taskCount: 80,
      sharedShootCount: 5,
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const call = rpcCalls()[0];
    expect(call?.fn).toBe('apply_templates_to_plan');
    const args = call?.args as {
      p_plan_id: string;
      p_shared_shoots: unknown[];
      p_entries: unknown[];
    };
    expect(args.p_plan_id).toBe(PLAN_ID);
    // 5 Snapchat weekly shoots (one per April 2026 week).
    expect(args.p_shared_shoots).toHaveLength(5);
    // 30 daily Snapchat + 5 weekly TikTok + 13 IG custom = 48 entries.
    expect(args.p_entries).toHaveLength(48);
  });

  it('404 when a requested template is missing', async () => {
    queueResults(
      { data: PLAN_ROW_APR_2026, error: null },
      { data: null, error: null, count: 0 },
      { data: [], error: null }, // empty templates result
    );

    const res = await request(buildApp())
      .post(`/plans/${PLAN_ID}/apply-templates`)
      .set(headers())
      .send({ templateIds: [TPL_SNAP_DAILY] });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp())
      .post(`/plans/${PLAN_ID}/apply-templates`)
      .set(headers())
      .send({ templateIds: [TPL_SNAP_DAILY] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });
});
