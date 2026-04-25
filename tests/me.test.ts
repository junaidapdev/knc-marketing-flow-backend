import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const VALID_TOKEN = 'valid.jwt.token';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const USER_EMAIL = 'user@example.com';

function withAuthorizedUser(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: USER_ID, email: USER_EMAIL } },
    error: null,
  });
}

describe('GET /me', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  it('returns 401 when no Authorization header is present', async () => {
    const app = buildApp();
    const res = await request(app).get('/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('returns 401 when token is invalid', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'jwt is malformed' },
    });
    const app = buildApp();

    const res = await request(app).get('/me').set('Authorization', 'Bearer bad');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 with TOKEN_EXPIRED when supabase reports expiry', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    const app = buildApp();

    const res = await request(app).get('/me').set('Authorization', 'Bearer expired');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 200 and the user envelope when token is valid', async () => {
    withAuthorizedUser();
    const app = buildApp();

    const res = await request(app).get('/me').set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { id: USER_ID, email: USER_EMAIL },
      meta: { timestamp: expect.any(String), requestId: expect.any(String) },
    });
    expect(authGetUserMock).toHaveBeenCalledWith(VALID_TOKEN);
  });
});
