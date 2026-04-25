import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, resetSupabaseMocks, setQueryResult } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const ASSIGNEE_ROW = {
  id: 'a-1',
  name: 'Ammar',
  role: 'content_engagement' as const,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

describe('GET /assignees', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns 401 without a token', async () => {
    const res = await request(buildApp()).get('/assignees');
    expect(res.status).toBe(401);
  });

  it('returns assignees mapped to domain shape', async () => {
    setQueryResult({ data: [ASSIGNEE_ROW], error: null });

    const res = await request(buildApp()).get('/assignees').set('Authorization', `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: 'a-1',
        name: 'Ammar',
        role: 'content_engagement',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });
});
