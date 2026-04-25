import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authGetUserMock,
  createSignedUploadUrlMock,
  createSignedUrlMock,
  queueResults,
  resetSupabaseMocks,
  rpcCalls,
  setRpcResult,
  storageFromMock,
} from './helpers/supabaseMock';
import { buildApp } from '../src/app';
import { clearAssigneeRoleCache } from '../src/services/taskService';

const TOKEN = 'valid.jwt';
const PLAN_ID = '11111111-1111-1111-1111-111111111111';
const BRANCH_ID = '22222222-2222-2222-2222-222222222222';
const ACTIVITY_ID = '33333333-3333-3333-3333-333333333333';
const CONTENT_ID = '55555555-5555-5555-5555-555555555555';
const PRODUCTION_ID = '66666666-6666-6666-6666-666666666666';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${TOKEN}` });

const ACTIVITY_ROW = {
  id: ACTIVITY_ID,
  plan_id: PLAN_ID,
  branch_id: BRANCH_ID,
  week_of: '2026-04-05',
  type: 'sampling',
  assignee_id: PRODUCTION_ID,
  status: 'planned',
  photo_url: null,
  notes: null,
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

describe('POST /shop-activities', () => {
  beforeEach(resetAll);

  it('creates an activity + execute task via RPC (201)', async () => {
    queueResults({ data: ASSIGNEE_ROWS, error: null });
    setRpcResult({ data: ACTIVITY_ROW, error: null });

    const res = await request(buildApp()).post('/shop-activities').set(headers()).send({
      planId: PLAN_ID,
      branchId: BRANCH_ID,
      weekOf: '2026-04-05',
      type: 'sampling',
    });

    expect(res.status).toBe(201);
    const args = rpcCalls()[0]?.args as {
      p_task: Record<string, unknown>;
      p_activity: Record<string, unknown>;
    };
    expect(args.p_task).toMatchObject({
      step: 'execute',
      due_date: '2026-04-05',
      assignee_id: PRODUCTION_ID,
    });
  });
});

describe('POST /shop-activities/:id/photo-upload-url', () => {
  beforeEach(resetAll);

  it('returns a signed upload URL + public read URL for an existing activity', async () => {
    queueResults({ data: ACTIVITY_ROW, error: null }); // getShopActivity

    const res = await request(buildApp())
      .post(`/shop-activities/${ACTIVITY_ID}/photo-upload-url`)
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.uploadUrl).toMatch(/^https:\/\/storage\.test\/upload\//);
    expect(res.body.data.publicUrl).toMatch(/^https:\/\/storage\.test\/read\//);
    expect(storageFromMock).toHaveBeenCalledWith('shop-activity-photos');
    expect(createSignedUploadUrlMock).toHaveBeenCalled();
    expect(createSignedUrlMock).toHaveBeenCalled();
  });

  it('404 when the activity does not exist', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp())
      .post(`/shop-activities/${ACTIVITY_ID}/photo-upload-url`)
      .set(headers());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SHOP_ACTIVITY_NOT_FOUND');
  });
});
