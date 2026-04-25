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
const BRAND_ID = '22222222-2222-2222-2222-222222222222';
const OFFER_ID = '33333333-3333-3333-3333-333333333333';
const BRANCH_A = '44444444-4444-4444-4444-444444444444';
const CONTENT_ID = '55555555-5555-5555-5555-555555555555';
const PRODUCTION_ID = '66666666-6666-6666-6666-666666666666';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

const OFFER_ROW = {
  id: OFFER_ID,
  plan_id: PLAN_ID,
  brand_id: BRAND_ID,
  name: 'Ramadan Bundle',
  type: 'bundle',
  branch_ids: [BRANCH_A],
  start_date: '2026-04-10',
  end_date: '2026-04-20',
  products_text: null,
  mechanic_text: null,
  budget_amount: '500.00',
  assignee_id: PRODUCTION_ID,
  status: 'planned',
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

describe('POST /offers', () => {
  beforeEach(resetAll);

  it('creates an offer and auto-generates a setup task due the day before the start date', async () => {
    queueResults({ data: ASSIGNEE_ROWS, error: null }); // resolveAssigneesByRole
    setRpcResult({ data: OFFER_ROW, error: null });

    const res = await request(buildApp())
      .post('/offers')
      .set(headers())
      .send({
        planId: PLAN_ID,
        brandId: BRAND_ID,
        name: 'Ramadan Bundle',
        type: 'bundle',
        branchIds: [BRANCH_A],
        startDate: '2026-04-10',
        endDate: '2026-04-20',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(OFFER_ID);
    expect(rpcMock).toHaveBeenCalledWith('create_offer_with_task', expect.any(Object));

    const call = rpcCalls()[0];
    const args = call?.args as {
      p_offer: Record<string, unknown>;
      p_task: Record<string, unknown>;
    };
    expect(args.p_task).toMatchObject({
      step: 'setup',
      assignee_id: PRODUCTION_ID,
      due_date: '2026-04-09',
    });
    expect(args.p_offer.assignee_id).toBe(PRODUCTION_ID);
  });

  it('honors an explicit assigneeId override', async () => {
    setRpcResult({ data: OFFER_ROW, error: null });

    await request(buildApp())
      .post('/offers')
      .set(headers())
      .send({
        planId: PLAN_ID,
        brandId: BRAND_ID,
        name: 'Ramadan Bundle',
        type: 'bundle',
        branchIds: [BRANCH_A],
        startDate: '2026-04-10',
        endDate: '2026-04-20',
        assigneeId: CONTENT_ID,
      });

    const args = rpcCalls()[0]?.args as {
      p_offer: Record<string, unknown>;
      p_task: Record<string, unknown>;
    };
    expect(args.p_task.assignee_id).toBe(CONTENT_ID);
    expect(args.p_offer.assignee_id).toBe(CONTENT_ID);
  });

  it('rejects endDate < startDate with 422 VALIDATION_FAILED at the schema layer', async () => {
    const res = await request(buildApp())
      .post('/offers')
      .set(headers())
      .send({
        planId: PLAN_ID,
        brandId: BRAND_ID,
        name: 'Backward dates',
        type: 'bundle',
        branchIds: [BRANCH_A],
        startDate: '2026-04-20',
        endDate: '2026-04-10',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /offers + filters', () => {
  beforeEach(resetAll);

  it('applies planId / brandId / status filters', async () => {
    queueResults({ data: [OFFER_ROW], error: null });
    const res = await request(buildApp())
      .get(`/offers?planId=${PLAN_ID}&brandId=${BRAND_ID}&status=planned`)
      .set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('DELETE /offers/:id', () => {
  beforeEach(resetAll);

  it('returns 404 when the offer is missing', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp()).delete(`/offers/${OFFER_ID}`).set(headers());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('OFFER_NOT_FOUND');
  });

  it('deletes an existing offer (204)', async () => {
    queueResults({ data: { id: OFFER_ID }, error: null }, { data: null, error: null });
    const res = await request(buildApp()).delete(`/offers/${OFFER_ID}`).set(headers());
    expect(res.status).toBe(204);
  });
});
