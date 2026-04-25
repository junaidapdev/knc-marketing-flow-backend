import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';
const USER_ID = '11111111-1111-1111-1111-111111111111';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

describe('GET /settings', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns redacted settings when a row exists', async () => {
    queueResults({
      data: {
        user_id: USER_ID,
        claude_api_key: 'sk-secret',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    });

    const res = await request(buildApp()).get('/settings').set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      userId: USER_ID,
      claudeApiKeySet: true,
      updatedAt: '2026-04-01T00:00:00Z',
    });
    // The raw key must never leave the server.
    expect(res.body.data.claudeApiKey).toBeUndefined();
  });

  it('lazily creates a row when none exists', async () => {
    queueResults(
      { data: null, error: null }, // first read returns nothing
      {
        data: {
          user_id: USER_ID,
          claude_api_key: null,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
        },
        error: null,
      }, // insert returns the fresh row
    );

    const res = await request(buildApp()).get('/settings').set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.claudeApiKeySet).toBe(false);
  });
});

describe('PATCH /settings', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('updates the Claude API key and returns redacted settings', async () => {
    queueResults({
      data: {
        user_id: USER_ID,
        claude_api_key: 'sk-new',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    });

    const res = await request(buildApp())
      .patch('/settings')
      .set(headers())
      .send({ claudeApiKey: 'sk-new' });

    expect(res.status).toBe(200);
    expect(res.body.data.claudeApiKeySet).toBe(true);
    expect(res.body.data.claudeApiKey).toBeUndefined();
  });

  it('accepts null to clear the key', async () => {
    queueResults({
      data: {
        user_id: USER_ID,
        claude_api_key: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    });

    const res = await request(buildApp())
      .patch('/settings')
      .set(headers())
      .send({ claudeApiKey: null });

    expect(res.status).toBe(200);
    expect(res.body.data.claudeApiKeySet).toBe(false);
  });

  it('422 on empty body', async () => {
    const res = await request(buildApp()).patch('/settings').set(headers()).send({});
    expect(res.status).toBe(422);
  });
});
