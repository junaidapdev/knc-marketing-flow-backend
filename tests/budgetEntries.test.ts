import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';
const PLAN_ID = '11111111-1111-1111-1111-111111111111';
const ENTRY_ID = '33333333-3333-3333-3333-333333333333';
const BRAND_ID = '22222222-2222-2222-2222-222222222222';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${TOKEN}` });

const ENTRY_ROW = {
  id: ENTRY_ID,
  plan_id: PLAN_ID,
  category: 'general_marketing',
  amount_sar: '100.00',
  date: '2026-04-15',
  description: 'Billboard',
  branch_id: BRAND_ID,
  linked_entity_type: null,
  linked_entity_id: null,
  receipt_url: null,
  created_at: '2026-04-01T00:00:00Z',
};

describe('POST /budget-entries', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('creates a budget entry and returns 201', async () => {
    queueResults({ data: ENTRY_ROW, error: null });

    const res = await request(buildApp()).post('/budget-entries').set(headers()).send({
      planId: PLAN_ID,
      category: 'general_marketing',
      amountSar: 100,
      date: '2026-04-15',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.amountSar).toBe(100);
  });
});

describe('GET /budget-entries/dashboard', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns aggregates with previous-month delta and ceiling percent', async () => {
    queueResults(
      { data: { id: PLAN_ID, month: 4, year: 2026, budget_ceiling: '1000.00' }, error: null }, // plan lookup
      {
        data: [
          { amount_sar: '300.00', category: 'general_marketing' },
          { amount_sar: '200.00', category: 'influencers' },
        ],
        error: null,
      }, // current rows
      { data: { id: 'prev-plan' }, error: null }, // previous plan lookup
      {
        data: [{ amount_sar: '400.00', category: 'general_marketing' }],
        error: null,
      }, // previous rows
    );

    const res = await request(buildApp())
      .get(`/budget-entries/dashboard?planId=${PLAN_ID}`)
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalSpent: 500,
      byCategory: {
        general_marketing: 300,
        influencers: 200,
        in_shop_activities: 0,
        product_offers: 0,
        camera_production: 0,
      },
      vsLastMonth: { total: 400, deltaPercent: 25 },
      ceilingUsedPercent: 50,
    });
  });

  it('omits vsLastMonth when no previous plan exists', async () => {
    queueResults(
      { data: { id: PLAN_ID, month: 4, year: 2026, budget_ceiling: null }, error: null },
      { data: [{ amount_sar: '250.00', category: 'general_marketing' }], error: null },
      { data: null, error: null }, // no previous plan
    );

    const res = await request(buildApp())
      .get(`/budget-entries/dashboard?planId=${PLAN_ID}`)
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.totalSpent).toBe(250);
    expect(res.body.data.vsLastMonth).toBeNull();
    expect(res.body.data.ceilingUsedPercent).toBeNull();
  });

  it('returns 404 when the plan does not exist', async () => {
    queueResults({ data: null, error: null });

    const res = await request(buildApp())
      .get(`/budget-entries/dashboard?planId=${PLAN_ID}`)
      .set(headers());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
  });
});
