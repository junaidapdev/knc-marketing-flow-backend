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

const headers = (): Record<string, string> => ({ Authorization: `Bearer ${TOKEN}` });

describe('GET /social/kpis', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('computes deltas across the 7d / 30d windows for each platform', async () => {
    const now = Date.now();
    const day = 86_400_000;

    const tiktokRows = [
      { platform: 'tiktok', captured_at: new Date(now - 28 * day).toISOString(), followers: 1000 },
      { platform: 'tiktok', captured_at: new Date(now - 6 * day).toISOString(), followers: 1100 },
      { platform: 'tiktok', captured_at: new Date(now - 1 * day).toISOString(), followers: 1200 },
    ];
    const igRows = [
      {
        platform: 'instagram',
        captured_at: new Date(now - 1 * day).toISOString(),
        followers: 500,
      },
    ];

    queueResults(
      { data: tiktokRows, error: null }, // tiktok history
      { data: igRows, error: null }, // instagram history
      { data: [], error: null }, // snapchat history (empty)
    );

    const res = await request(buildApp()).get('/social/kpis').set(headers());

    expect(res.status).toBe(200);
    const data = res.body.data as Array<{
      platform: string;
      followers: number | null;
      delta7d: number | null;
      delta30d: number | null;
    }>;
    const tiktok = data.find((d) => d.platform === 'tiktok');
    expect(tiktok?.followers).toBe(1200);
    expect(tiktok?.delta7d).toBe(100); // 1200 - 1100
    expect(tiktok?.delta30d).toBe(200); // 1200 - 1000

    const ig = data.find((d) => d.platform === 'instagram');
    expect(ig?.followers).toBe(500);
    expect(ig?.delta7d).toBeNull(); // only one snapshot, no prior
    expect(ig?.delta30d).toBeNull();

    const snap = data.find((d) => d.platform === 'snapchat');
    expect(snap?.followers).toBeNull();
  });
});

describe('GET /social/snapshots', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns the time series', async () => {
    queueResults({
      data: [
        {
          id: 's-1',
          platform: 'tiktok',
          brand_id: 'b-1',
          captured_at: '2026-04-20T00:00:00Z',
          followers: 1000,
          total_likes: '50000',
          total_videos: 42,
          created_at: '2026-04-20T00:00:00Z',
        },
      ],
      error: null,
    });

    const res = await request(buildApp())
      .get('/social/snapshots?platform=tiktok&days=30')
      .set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].followers).toBe(1000);
    expect(res.body.data[0].totalLikes).toBe(50000);
  });
});

describe('GET /social/posts', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns posts mapped to domain shape', async () => {
    queueResults({
      data: [
        {
          id: 'p-1',
          platform: 'tiktok',
          brand_id: 'b-1',
          external_id: '7000',
          url: 'https://tt/7000',
          caption: 'hi',
          posted_at: '2026-04-10T00:00:00Z',
          duration_seconds: 12,
          plays: '5000',
          likes: '300',
          comments: '20',
          shares: '5',
          saves: '2',
          hashtags: ['kayan'],
          thumbnail_url: 'https://cdn/x.jpg',
          last_synced_at: '2026-04-25T00:00:00Z',
          created_at: '2026-04-10T00:00:00Z',
        },
      ],
      error: null,
    });

    const res = await request(buildApp()).get('/social/posts?limit=10').set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data[0].plays).toBe(5000);
    expect(res.body.data[0].likes).toBe(300);
  });

  it('422 on invalid sortBy', async () => {
    const res = await request(buildApp()).get('/social/posts?sortBy=banana').set(headers());
    expect(res.status).toBe(422);
  });
});

describe('GET /social/sync-status', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('returns the latest log + per-platform breakdown', async () => {
    queueResults({
      data: [
        {
          id: 'l-1',
          platform: 'tiktok',
          triggered_by: 'cron',
          started_at: '2026-04-25T08:00:00Z',
          finished_at: '2026-04-25T08:00:30Z',
          status: 'success',
          posts_upserted: 20,
          error_message: null,
          created_at: '2026-04-25T08:00:00Z',
        },
        {
          id: 'l-2',
          platform: 'instagram',
          triggered_by: 'cron',
          started_at: '2026-04-25T07:55:00Z',
          finished_at: '2026-04-25T07:55:30Z',
          status: 'failed',
          posts_upserted: 0,
          error_message: 'Apify 401',
          created_at: '2026-04-25T07:55:00Z',
        },
      ],
      error: null,
    });

    const res = await request(buildApp()).get('/social/sync-status').set(headers());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('success');
    expect(res.body.data.lastByPlatform).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ platform: 'tiktok', status: 'success' }),
        expect.objectContaining({ platform: 'instagram', status: 'failed' }),
      ]),
    );
  });
});
