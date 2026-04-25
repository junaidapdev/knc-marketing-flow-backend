import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

// Keep in sync with `vitest.config.ts` — that's where the env is seeded
// before the env module is imported by the test run.
const SERVICE_TOKEN = 'test-service-token';

function authenticateJwt(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const LOG_DEFAULTS = {
  id: 'log-1',
  platform: 'tiktok',
  triggered_by: null,
  started_at: '2026-04-24T00:00:00Z',
  finished_at: null,
  status: 'running',
  posts_upserted: 0,
  error_message: null,
  created_at: '2026-04-24T00:00:00Z',
};

function logRow(over: Record<string, unknown>): Record<string, unknown> {
  return { ...LOG_DEFAULTS, ...over };
}

/**
 * Seed enough query results for a full one-platform run that hits
 * the "no account configured" branch (fastest happy-path through the
 * orchestrator without needing fetch stubs).
 */
function seedNoAccountRun(): void {
  queueResults(
    { data: [], error: null }, // list accounts
    { data: logRow({ status: 'running' }), error: null }, // start log
    { data: logRow({ status: 'failed' }), error: null }, // finalize log
  );
}

describe('/social/sync auth — service token path', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticateJwt();
  });

  it('accepts a matching SERVICE_TOKEN without consulting Supabase Auth', async () => {
    seedNoAccountRun();

    const res = await request(buildApp())
      .post('/social/sync?platform=tiktok')
      .set('Authorization', `Bearer ${SERVICE_TOKEN}`);

    expect(res.status).toBe(200);
    // The JWT path never ran.
    expect(authGetUserMock).not.toHaveBeenCalled();
  });

  it('rejects a mismatched bearer with 401 when JWT verification also fails', async () => {
    // Override the default JWT mock so the fallback rejects too.
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'jwt is malformed' },
    });

    const res = await request(buildApp())
      .post('/social/sync')
      .set('Authorization', 'Bearer totally-wrong-token');

    expect(res.status).toBe(401);
  });

  it('still accepts a real user JWT (falls through when no service match)', async () => {
    seedNoAccountRun();

    const res = await request(buildApp())
      .post('/social/sync?platform=tiktok')
      .set('Authorization', 'Bearer some.user.jwt');

    expect(res.status).toBe(200);
    expect(authGetUserMock).toHaveBeenCalled();
  });
});

describe('POST /social/refresh — admin alias', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticateJwt();
  });

  it('behaves like /social/sync (200 with summary)', async () => {
    seedNoAccountRun();

    const res = await request(buildApp())
      .post('/social/refresh?platform=tiktok')
      .set('Authorization', 'Bearer some.user.jwt');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('logs');
    expect(res.body.data).toHaveProperty('successCount');
  });

  it('accepts the service token too', async () => {
    seedNoAccountRun();

    const res = await request(buildApp())
      .post('/social/refresh?platform=tiktok')
      .set('Authorization', `Bearer ${SERVICE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('422 on invalid platform query', async () => {
    const res = await request(buildApp())
      .post('/social/refresh?platform=myspace')
      .set('Authorization', `Bearer ${SERVICE_TOKEN}`);

    expect(res.status).toBe(422);
  });
});

describe('service-token hardening', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  it('never accepts an empty bearer, even if SERVICE_TOKEN were accidentally cleared', async () => {
    // Reset authGetUserMock so the fallback path fails outright.
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'missing token' },
    });

    const res = await request(buildApp()).post('/social/sync').set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
  });

  // Sanity: restoring state so later files don't see a leaked mock.
  it('restores auth mock afterwards', () => {
    const m = vi.mocked(authGetUserMock);
    m.mockReset();
    expect(m).toBeDefined();
  });
});
