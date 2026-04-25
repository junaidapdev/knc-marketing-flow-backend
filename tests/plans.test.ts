import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authGetUserMock,
  callsOn,
  queueResults,
  resetSupabaseMocks,
  rpcCalls,
  rpcMock,
  setRpcResult,
} from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';
const PLAN_ID = '11111111-1111-1111-1111-111111111111';
const BRAND_ID = '22222222-2222-2222-2222-222222222222';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const PLAN_ROW = {
  id: PLAN_ID,
  month: 4,
  year: 2026,
  budget_ceiling: '50000.00',
  status: 'draft',
  created_at: '2026-04-01T00:00:00Z',
};

function signedHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

describe('GET /plans', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns 401 without a token', async () => {
    const res = await request(buildApp()).get('/plans');
    expect(res.status).toBe(401);
  });

  it('returns plans mapped to domain shape, newest first', async () => {
    queueResults({ data: [PLAN_ROW], error: null });

    const res = await request(buildApp()).get('/plans').set(signedHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: PLAN_ID,
        month: 4,
        year: 2026,
        budgetCeiling: '50000.00',
        status: 'draft',
        createdAt: '2026-04-01T00:00:00Z',
      },
    ]);
  });
});

describe('GET /plans/:id', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns the plan with entry count', async () => {
    queueResults(
      { data: PLAN_ROW, error: null }, // plan fetch
      { data: null, error: null, count: 7 }, // entry count
    );

    const res = await request(buildApp()).get(`/plans/${PLAN_ID}`).set(signedHeaders());

    expect(res.status).toBe(200);
    expect(res.body.data.entryCount).toBe(7);
    expect(res.body.data.id).toBe(PLAN_ID);
  });

  it('returns 404 when the plan is missing', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp()).get(`/plans/${PLAN_ID}`).set(signedHeaders());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });
});

describe('POST /plans', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('creates a plain plan without entries and returns 201', async () => {
    queueResults({ data: PLAN_ROW, error: null });

    const res = await request(buildApp())
      .post('/plans')
      .set(signedHeaders())
      .send({ month: 4, year: 2026, budgetCeiling: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(PLAN_ID);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 409 on duplicate month/year', async () => {
    queueResults({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const res = await request(buildApp())
      .post('/plans')
      .set(signedHeaders())
      .send({ month: 4, year: 2026 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAN_DUPLICATE_MONTH');
  });

  it('returns 422 when the body fails validation', async () => {
    const res = await request(buildApp())
      .post('/plans')
      .set(signedHeaders())
      .send({ month: 13, year: 2026 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('creates a plan with entries via RPC and returns 201', async () => {
    setRpcResult({ data: PLAN_ID, error: null });
    queueResults({ data: PLAN_ROW, error: null }); // fetch after RPC

    const res = await request(buildApp())
      .post('/plans')
      .set(signedHeaders())
      .send({
        month: 4,
        year: 2026,
        entries: [
          {
            brandId: BRAND_ID,
            date: '2026-04-10',
            type: 'snap_story',
            title: 'Ramadan story',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const call = rpcCalls()[0];
    expect(call?.fn).toBe('create_plan_with_entries');
  });

  it('maps an RPC invalid-parameter error to 422 ENTRY_DATE_OUT_OF_PLAN', async () => {
    setRpcResult({
      data: null,
      error: { code: '22023', message: 'entry date 2026-05-01 is outside plan 4/2026' },
    });

    const res = await request(buildApp())
      .post('/plans')
      .set(signedHeaders())
      .send({
        month: 4,
        year: 2026,
        entries: [
          {
            brandId: BRAND_ID,
            date: '2026-05-01',
            type: 'snap_story',
            title: 'Wrong month',
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ENTRY_DATE_OUT_OF_PLAN');
  });
});

describe('PATCH /plans/:id', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('updates a plan and returns 200', async () => {
    queueResults({ data: { ...PLAN_ROW, status: 'published' }, error: null });

    const res = await request(buildApp())
      .patch(`/plans/${PLAN_ID}`)
      .set(signedHeaders())
      .send({ status: 'published' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
  });

  it('returns 404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp())
      .patch(`/plans/${PLAN_ID}`)
      .set(signedHeaders())
      .send({ status: 'published' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });

  it('returns 422 when the body is empty', async () => {
    const res = await request(buildApp()).patch(`/plans/${PLAN_ID}`).set(signedHeaders()).send({});

    expect(res.status).toBe(422);
  });
});

describe('DELETE /plans/:id', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('deletes a draft plan and returns 204', async () => {
    queueResults(
      { data: { id: PLAN_ID, status: 'draft' }, error: null }, // status check
      { data: null, error: null }, // delete
    );

    const res = await request(buildApp()).delete(`/plans/${PLAN_ID}`).set(signedHeaders());

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    // Verify the delete actually fired
    expect(callsOn('plan').some((c) => c.method === 'delete')).toBe(true);
  });

  it('refuses to delete a published plan (409)', async () => {
    queueResults({ data: { id: PLAN_ID, status: 'published' }, error: null });

    const res = await request(buildApp()).delete(`/plans/${PLAN_ID}`).set(signedHeaders());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAN_ALREADY_PUBLISHED');
  });

  it('returns 404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp()).delete(`/plans/${PLAN_ID}`).set(signedHeaders());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });
});
