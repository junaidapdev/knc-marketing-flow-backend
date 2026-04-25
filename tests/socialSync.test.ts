import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authGetUserMock, queueResults, resetSupabaseMocks } from './helpers/supabaseMock';
import { buildApp } from '../src/app';
import { runSocialSync } from '../src/services/socialSyncService';
import type { PlatformScraper } from '../src/services/scrapers';
import type { Platform } from '../src/types/domain/platform';

const TOKEN = 'valid.jwt';
const BRAND_ID = '11111111-1111-1111-1111-111111111111';

const LOG_COLS = {
  platform: 'tiktok',
  triggered_by: null,
  started_at: '2026-04-24T00:00:00Z',
  finished_at: null,
  status: 'running',
  posts_upserted: 0,
  error_message: null,
  created_at: '2026-04-24T00:00:00Z',
};

function syncLogRow(over: Record<string, unknown>): Record<string, unknown> {
  return { id: 'log-1', ...LOG_COLS, ...over };
}

function authenticate(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: 'u-1', email: 'user@example.com' } },
    error: null,
  });
}

function makeScraper(platform: Platform, opts: { fail?: boolean } = {}): PlatformScraper {
  const scraper: PlatformScraper = {
    platform,
    fetchProfile: vi.fn(async () => {
      if (opts.fail) throw new Error('boom');
      return { followers: 100, totalLikes: 200, totalVideos: 5 };
    }),
    fetchRecentPosts:
      platform === 'snapchat'
        ? undefined
        : vi.fn(async () => [
            {
              externalId: `${platform}-1`,
              url: null,
              caption: null,
              postedAt: null,
              durationSeconds: null,
              plays: 10,
              likes: 1,
              comments: 0,
              shares: 0,
              saves: 0,
              hashtags: [],
              thumbnailUrl: null,
            },
          ]),
  };
  return scraper;
}

describe('runSocialSync (service)', () => {
  beforeEach(() => {
    resetSupabaseMocks();
  });

  it('returns failed log when no account exists for the platform', async () => {
    queueResults(
      // list_active_accounts_for → empty
      { data: [], error: null },
      // start sync_log
      { data: syncLogRow({ platform: 'tiktok', status: 'running' }), error: null },
      // finalize sync_log
      { data: syncLogRow({ platform: 'tiktok', status: 'failed' }), error: null },
    );

    const scrapers = {
      tiktok: makeScraper('tiktok'),
      instagram: makeScraper('instagram'),
      snapchat: makeScraper('snapchat'),
    };

    const summary = await runSocialSync({ platform: 'tiktok', scrapers });

    expect(summary.failedCount).toBe(1);
    expect(summary.successCount).toBe(0);
    expect(summary.logs[0]?.status).toBe('failed');
  });

  it('records success + posts_upserted when scraper succeeds', async () => {
    queueResults(
      {
        data: [
          {
            id: 'a-1',
            platform: 'tiktok',
            handle: '@k',
            brand_id: BRAND_ID,
            is_active: true,
            created_at: '',
          },
        ],
        error: null,
      },
      { data: syncLogRow({ platform: 'tiktok', status: 'running' }), error: null },
      { data: null, error: null }, // insertSnapshot (thenable, no-op data)
      { data: null, error: null }, // upsertPosts
      {
        data: syncLogRow({ platform: 'tiktok', status: 'success', posts_upserted: 1 }),
        error: null,
      },
    );

    const scrapers = {
      tiktok: makeScraper('tiktok'),
      instagram: makeScraper('instagram'),
      snapchat: makeScraper('snapchat'),
    };

    const summary = await runSocialSync({ platform: 'tiktok', scrapers });
    expect(summary.successCount).toBe(1);
    expect(summary.totalPostsUpserted).toBe(1);
    expect(summary.logs[0]?.status).toBe('success');
  });

  it("records failed + error_message when the scraper throws — and doesn't kill other platforms", async () => {
    // tiktok fails; instagram succeeds; snapchat succeeds.
    queueResults(
      // accounts (all 3 platforms)
      {
        data: [
          {
            id: 'a-1',
            platform: 'tiktok',
            handle: '@k',
            brand_id: BRAND_ID,
            is_active: true,
            created_at: '',
          },
          {
            id: 'a-2',
            platform: 'instagram',
            handle: '@k',
            brand_id: BRAND_ID,
            is_active: true,
            created_at: '',
          },
          {
            id: 'a-3',
            platform: 'snapchat',
            handle: '@k',
            brand_id: BRAND_ID,
            is_active: true,
            created_at: '',
          },
        ],
        error: null,
      },
      // tiktok: start log → fail finalize
      { data: syncLogRow({ platform: 'tiktok', status: 'running' }), error: null },
      {
        data: syncLogRow({ platform: 'tiktok', status: 'failed', error_message: 'boom' }),
        error: null,
      },
      // instagram: start → insert snapshot → upsert posts → success finalize
      { data: syncLogRow({ platform: 'instagram', status: 'running' }), error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: syncLogRow({ platform: 'instagram', status: 'success', posts_upserted: 1 }),
        error: null,
      },
      // snapchat: start → insert snapshot → success finalize (no posts)
      { data: syncLogRow({ platform: 'snapchat', status: 'running' }), error: null },
      { data: null, error: null },
      {
        data: syncLogRow({ platform: 'snapchat', status: 'success', posts_upserted: 0 }),
        error: null,
      },
    );

    const scrapers = {
      tiktok: makeScraper('tiktok', { fail: true }),
      instagram: makeScraper('instagram'),
      snapchat: makeScraper('snapchat'),
    };

    const summary = await runSocialSync({ scrapers });
    expect(summary.logs.map((l) => l.status)).toEqual(['failed', 'success', 'success']);
    expect(summary.successCount).toBe(2);
    expect(summary.failedCount).toBe(1);
  });
});

describe('POST /social/sync', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    authenticate();
  });

  it('401 without a token', async () => {
    const res = await request(buildApp()).post('/social/sync');
    expect(res.status).toBe(401);
  });

  it('returns a sync summary for the requested platform (via real scrapers hitting mocked Apify through the service code path)', async () => {
    // One account → start log → insert snapshot → upsert posts → finalize.
    // The real scrapers fetch through ApifyClient, which calls `fetch`;
    // we stub global `fetch` to return an empty items array so the
    // scraper succeeds with null stats and 0 posts.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    queueResults(
      {
        data: [
          {
            id: 'a-1',
            platform: 'tiktok',
            handle: '@k',
            brand_id: BRAND_ID,
            is_active: true,
            created_at: '',
          },
        ],
        error: null,
      },
      { data: syncLogRow({ platform: 'tiktok', status: 'running' }), error: null },
      { data: null, error: null }, // insertSnapshot
      {
        data: syncLogRow({ platform: 'tiktok', status: 'success', posts_upserted: 0 }),
        error: null,
      },
    );

    const res = await request(buildApp())
      .post('/social/sync?platform=tiktok')
      .set({ Authorization: `Bearer ${TOKEN}` });

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('422 when platform query param is invalid', async () => {
    const res = await request(buildApp())
      .post('/social/sync?platform=facebook')
      .set({ Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(422);
  });
});
