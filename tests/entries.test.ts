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
const PLAN_ID = '11111111-1111-1111-1111-111111111111';
const ENTRY_ID = '33333333-3333-3333-3333-333333333333';
const BRAND_ID = '22222222-2222-2222-2222-222222222222';
const CONTENT_ID = '44444444-4444-4444-4444-444444444444';
const PRODUCTION_ID = '55555555-5555-5555-5555-555555555555';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

const ENTRY_ROW = {
  id: ENTRY_ID,
  plan_id: PLAN_ID,
  brand_id: BRAND_ID,
  date: '2026-04-10',
  type: 'snap_story',
  platform: null,
  title: 'Ramadan story',
  script: null,
  notes: null,
  status: 'planned',
  template_id: null,
  created_at: '2026-04-01T00:00:00Z',
};

const PLAN_APR_2026 = {
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

describe('GET /plans/:planId/entries', () => {
  beforeEach(resetAll);

  it('returns entries filtered by date and brand', async () => {
    queueResults({ data: [ENTRY_ROW], error: null });

    const res = await request(buildApp())
      .get(`/plans/${PLAN_ID}/entries?date=2026-04-10&brandId=${BRAND_ID}`)
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].planId).toBe(PLAN_ID);
    expect(res.body.data[0].brandId).toBe(BRAND_ID);
  });

  it('rejects an invalid date format (422)', async () => {
    const res = await request(buildApp())
      .get(`/plans/${PLAN_ID}/entries?date=2026-4-10`)
      .set(headers());
    expect(res.status).toBe(422);
  });
});

describe('POST /plans/:planId/entries', () => {
  beforeEach(resetAll);

  it('creates an entry via RPC and returns 201', async () => {
    queueResults(
      { data: PLAN_APR_2026, error: null }, // assertPlanCoversDate
      { data: ASSIGNEE_ROWS, error: null }, // resolveAssigneesByRole
    );
    setRpcResult({ data: ENTRY_ROW, error: null });

    const res = await request(buildApp()).post(`/plans/${PLAN_ID}/entries`).set(headers()).send({
      brandId: BRAND_ID,
      date: '2026-04-10',
      type: 'snap_story',
      title: 'Ramadan story',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(ENTRY_ID);
    expect(rpcMock).toHaveBeenCalledWith('create_entry_with_tasks', expect.any(Object));
  });

  it('auto-generates a 4-task chain for a TikTok entry with correct dates and assignees', async () => {
    queueResults({ data: PLAN_APR_2026, error: null }, { data: ASSIGNEE_ROWS, error: null });
    setRpcResult({ data: { ...ENTRY_ROW, type: 'tiktok_video' }, error: null });

    const res = await request(buildApp()).post(`/plans/${PLAN_ID}/entries`).set(headers()).send({
      brandId: BRAND_ID,
      date: '2026-04-10',
      type: 'tiktok_video',
      title: 'Ramadan Day 1',
    });

    expect(res.status).toBe(201);
    const call = rpcCalls()[0];
    expect(call?.fn).toBe('create_entry_with_tasks');
    const args = call?.args as { p_tasks: unknown[] };
    expect(args.p_tasks).toEqual([
      { assignee_id: CONTENT_ID, due_date: '2026-04-07', step: 'script', status: 'pending' },
      { assignee_id: PRODUCTION_ID, due_date: '2026-04-08', step: 'shoot', status: 'pending' },
      { assignee_id: PRODUCTION_ID, due_date: '2026-04-09', step: 'edit', status: 'pending' },
      { assignee_id: PRODUCTION_ID, due_date: '2026-04-10', step: 'post', status: 'pending' },
    ]);
  });

  it('emits a single content-engagement post task for snap_story', async () => {
    queueResults({ data: PLAN_APR_2026, error: null }, { data: ASSIGNEE_ROWS, error: null });
    setRpcResult({ data: ENTRY_ROW, error: null });

    await request(buildApp()).post(`/plans/${PLAN_ID}/entries`).set(headers()).send({
      brandId: BRAND_ID,
      date: '2026-04-10',
      type: 'snap_story',
      title: 'Ramadan story',
    });

    const args = rpcCalls()[0]?.args as { p_tasks: unknown[] };
    expect(args.p_tasks).toEqual([
      { assignee_id: CONTENT_ID, due_date: '2026-04-10', step: 'post', status: 'pending' },
    ]);
  });

  it('refuses an entry outside the plan month with 422 ENTRY_DATE_OUT_OF_PLAN', async () => {
    queueResults({ data: PLAN_APR_2026, error: null });

    const res = await request(buildApp()).post(`/plans/${PLAN_ID}/entries`).set(headers()).send({
      brandId: BRAND_ID,
      date: '2026-05-10',
      type: 'snap_story',
      title: 'Wrong month',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ENTRY_DATE_OUT_OF_PLAN');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp()).post(`/plans/${PLAN_ID}/entries`).set(headers()).send({
      brandId: BRAND_ID,
      date: '2026-04-10',
      type: 'snap_story',
      title: 'x',
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });
});

describe('PATCH /entries/:id', () => {
  beforeEach(resetAll);

  it('updates an entry with a same-month date and returns 200', async () => {
    queueResults(
      { data: ENTRY_ROW, error: null }, // getEntry
      { data: { ...ENTRY_ROW, title: 'Updated' }, error: null }, // update
    );

    const res = await request(buildApp())
      .patch(`/entries/${ENTRY_ID}`)
      .set(headers())
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated');
  });

  it('refuses a date change that falls outside the plan month', async () => {
    queueResults(
      { data: ENTRY_ROW, error: null }, // getEntry
      { data: PLAN_APR_2026, error: null }, // assertPlanCoversDate
    );

    const res = await request(buildApp())
      .patch(`/entries/${ENTRY_ID}`)
      .set(headers())
      .send({ date: '2026-06-01' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ENTRY_DATE_OUT_OF_PLAN');
  });

  it('returns 404 when the entry does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp())
      .patch(`/entries/${ENTRY_ID}`)
      .set(headers())
      .send({ title: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ENTRY_NOT_FOUND');
  });
});

describe('DELETE /entries/:id', () => {
  beforeEach(resetAll);

  it('deletes an existing entry and returns 204', async () => {
    queueResults(
      { data: { id: ENTRY_ID }, error: null }, // existence check
      { data: null, error: null }, // delete
    );

    const res = await request(buildApp()).delete(`/entries/${ENTRY_ID}`).set(headers());
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('returns 404 when the entry is missing', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp()).delete(`/entries/${ENTRY_ID}`).set(headers());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ENTRY_NOT_FOUND');
  });
});
