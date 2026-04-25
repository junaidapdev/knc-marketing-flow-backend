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

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const BRAND_ROW = {
  id: 'b-1',
  name: 'Kayan Sweets',
  is_active: true,
  is_hidden: false,
  accent_color: '#D4A017',
  created_at: '2026-01-01T00:00:00Z',
};

describe('GET /brands', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns 401 without a token', async () => {
    const res = await request(buildApp()).get('/brands');
    expect(res.status).toBe(401);
  });

  it('returns active, non-hidden brands mapped to domain shape', async () => {
    setQueryResult({ data: [BRAND_ROW], error: null });

    const res = await request(buildApp()).get('/brands').set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      {
        id: 'b-1',
        name: 'Kayan Sweets',
        isActive: true,
        isHidden: false,
        accentColor: '#D4A017',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const filters = eqCalls();
    expect(filters).toContainEqual(['is_hidden', false]);
    expect(filters).toContainEqual(['is_active', true]);
  });

  it('includes inactive when ?includeInactive=true', async () => {
    setQueryResult({ data: [], error: null });

    await request(buildApp())
      .get('/brands?includeInactive=true')
      .set('Authorization', `Bearer ${TOKEN}`);

    const filters = eqCalls();
    expect(filters).toContainEqual(['is_hidden', false]);
    expect(filters).not.toContainEqual(['is_active', true]);
  });
});
