import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

describe('GET /health', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  it('returns 200 with the standard envelope (no auth required)', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok' },
      meta: { timestamp: expect.any(String), requestId: expect.any(String) },
    });
    expect(res.body.data.version).toEqual(expect.any(String));
    expect(res.body.data.uptime).toEqual(expect.any(Number));
  });

  it('propagates incoming x-request-id', async () => {
    const incoming = 'test-req-id-abc-123';
    const res = await request(buildApp()).get('/health').set('x-request-id', incoming);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(incoming);
    expect(res.body.meta.requestId).toBe(incoming);
  });

  it('returns 404 for unknown routes when authenticated', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'u-1', email: 'user@example.com' } },
      error: null,
    });

    const res = await request(buildApp())
      .get('/does-not-exist')
      .set('Authorization', 'Bearer valid.jwt');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('returns 401 for unknown routes when unauthenticated', async () => {
    const res = await request(buildApp()).get('/does-not-exist');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
