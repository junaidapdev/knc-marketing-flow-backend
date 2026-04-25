import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';

const TOKEN = 'valid.jwt';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

function taskRow(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 't-1',
    calendar_entry_id: null,
    offer_id: null,
    shop_activity_id: null,
    assignee_id: 'a-1',
    due_date: '2026-04-10',
    step: 'post',
    status: 'pending',
    notes: null,
    shared_shoot_id: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...over,
  };
}

describe('GET /notifications', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns overdue / dueToday / recent buckets with counts', async () => {
    queueResults(
      { data: [taskRow({ id: 'overdue-1', due_date: '2020-01-01' })], error: null },
      { data: [taskRow({ id: 'today-1' })], error: null },
      {
        data: [taskRow({ id: 'recent-1', status: 'done' })],
        error: null,
      },
    );

    const res = await request(buildApp()).get('/notifications').set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data.overdue).toHaveLength(1);
    expect(res.body.data.dueToday).toHaveLength(1);
    expect(res.body.data.recent).toHaveLength(1);
    expect(res.body.data.counts).toEqual({
      overdue: 1,
      dueToday: 1,
      recent: 1,
      total: 2,
    });
  });

  it('401 without a token', async () => {
    const res = await request(buildApp()).get('/notifications');
    expect(res.status).toBe(401);
  });

  it('returns empty buckets when nothing is pending or recent', async () => {
    queueResults({ data: [], error: null }, { data: [], error: null }, { data: [], error: null });
    const res = await request(buildApp()).get('/notifications').set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data.counts.total).toBe(0);
  });
});
