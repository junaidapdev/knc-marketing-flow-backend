import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';
import { clearAssigneeRoleCache } from '../src/services/taskService';

const TOKEN = 'valid.jwt';
const TASK_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ASSIGNEE_ID = '11111111-1111-1111-1111-111111111111';

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${TOKEN}` };
}

function taskRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: TASK_ID,
    calendar_entry_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    offer_id: null,
    shop_activity_id: null,
    assignee_id: ASSIGNEE_ID,
    due_date: '2026-04-10',
    step: 'post',
    status: 'pending',
    notes: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

describe('GET /tasks', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    clearAssigneeRoleCache();
    authenticate();
  });

  it('returns filtered tasks', async () => {
    queueResults({ data: [taskRow()], error: null });

    const res = await request(buildApp())
      .get(`/tasks?assigneeId=${ASSIGNEE_ID}&status=pending`)
      .set(headers());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].step).toBe('post');
  });

  it('rejects an invalid dueDate (422)', async () => {
    const res = await request(buildApp()).get('/tasks?dueDate=2026-4-10').set(headers());
    expect(res.status).toBe(422);
  });
});

describe('GET /tasks/today', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    clearAssigneeRoleCache();
    authenticate();
  });

  it("groups today's tasks by assigneeId", async () => {
    queueResults({
      data: [
        taskRow({ id: 't-1', assignee_id: 'a-1', step: 'script' }),
        taskRow({ id: 't-2', assignee_id: 'a-1', step: 'edit' }),
        taskRow({ id: 't-3', assignee_id: 'a-2', step: 'post' }),
      ],
      error: null,
    });

    const res = await request(buildApp()).get('/tasks/today').set(headers());
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['a-1', 'a-2']);
    expect(res.body.data['a-1']).toHaveLength(2);
    expect(res.body.data['a-2']).toHaveLength(1);
  });
});

describe('PATCH /tasks/:id — state machine', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    clearAssigneeRoleCache();
    authenticate();
  });

  it('allows pending → in_progress (200)', async () => {
    queueResults(
      { data: taskRow({ status: 'pending' }), error: null }, // getTask
      { data: taskRow({ status: 'in_progress' }), error: null }, // update
    );
    const res = await request(buildApp())
      .patch(`/tasks/${TASK_ID}`)
      .set(headers())
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('allows skipped → pending (un-skip)', async () => {
    queueResults(
      { data: taskRow({ status: 'skipped' }), error: null },
      { data: taskRow({ status: 'pending' }), error: null },
    );
    const res = await request(buildApp())
      .patch(`/tasks/${TASK_ID}`)
      .set(headers())
      .send({ status: 'pending' });
    expect(res.status).toBe(200);
  });

  it.each([
    ['pending', 'done'],
    ['done', 'pending'],
    ['done', 'in_progress'],
    ['in_progress', 'pending'],
  ] as const)('rejects %s → %s (422)', async (from, to) => {
    queueResults({ data: taskRow({ status: from }), error: null });
    const res = await request(buildApp())
      .patch(`/tasks/${TASK_ID}`)
      .set(headers())
      .send({ status: to });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TASK_TRANSITION');
  });

  it('returns 404 when the task is missing', async () => {
    queueResults({ data: null, error: null });
    const res = await request(buildApp())
      .patch(`/tasks/${TASK_ID}`)
      .set(headers())
      .send({ status: 'in_progress' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});
