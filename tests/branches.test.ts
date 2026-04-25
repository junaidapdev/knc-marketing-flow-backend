import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authGetUserMock,
  eqCalls,
  resetSupabaseMocks,
  setQueryResult,
} from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';
const BRAND_ID = '22222222-2222-2222-2222-222222222222';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const BRANCH_ROW = {
  id: 'br-1',
  name: 'Al Salama',
  city: 'Jeddah',
  brand_id: BRAND_ID,
  has_boxed_chocolates: true,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

describe('GET /branches', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns 401 without a token', async () => {
    const res = await request(buildApp()).get('/branches');
    expect(res.status).toBe(401);
  });

  it('returns branches mapped to domain shape', async () => {
    setQueryResult({ data: [BRANCH_ROW], error: null });

    const res = await request(buildApp()).get('/branches').set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: 'br-1',
        name: 'Al Salama',
        city: 'Jeddah',
        brandId: BRAND_ID,
        hasBoxedChocolates: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('applies brandId and city filters', async () => {
    setQueryResult({ data: [], error: null });

    const res = await request(buildApp())
      .get(`/branches?brandId=${BRAND_ID}&city=Jeddah`)
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    const filters = eqCalls();
    expect(filters).toContainEqual(['is_active', true]);
    expect(filters).toContainEqual(['brand_id', BRAND_ID]);
    expect(filters).toContainEqual(['city', 'Jeddah']);
  });

  it('rejects an invalid brandId with VALIDATION_FAILED', async () => {
    const res = await request(buildApp())
      .get('/branches?brandId=not-a-uuid')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
