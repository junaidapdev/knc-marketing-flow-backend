import { describe, expect, it, vi } from 'vitest';
import type { ApifyClient } from '../src/services/scrapers/apifyClient';
import { InstagramScraper } from '../src/services/scrapers/instagramScraper';
import { SnapchatScraper } from '../src/services/scrapers/snapchatScraper';
import { TikTokScraper } from '../src/services/scrapers/tiktokScraper';

function makeClient<T>(items: T[]): ApifyClient {
  return {
    runActorAndGetItems: vi.fn(
      async () => items as unknown[],
    ) as ApifyClient['runActorAndGetItems'],
  };
}

describe('TikTokScraper', () => {
  it('maps Apify items into PostData with hashtags normalized', async () => {
    const client = makeClient([
      {
        id: '7000',
        webVideoUrl: 'https://tiktok/x/7000',
        text: 'Ramadan launch',
        createTimeISO: '2026-04-10T12:00:00Z',
        playCount: 1200,
        diggCount: 80,
        commentCount: 5,
        shareCount: 2,
        collectCount: 1,
        hashtags: [{ name: 'ramadan' }, 'kayan'],
        videoMeta: { duration: 12, coverUrl: 'https://cdn/x.jpg' },
        authorMeta: { fans: 10000, heart: 50000, video: 42 },
      },
    ]);

    const scraper = new TikTokScraper(client);
    const posts = await scraper.fetchRecentPosts('@kayan_sweets');

    expect(posts).toEqual([
      {
        externalId: '7000',
        url: 'https://tiktok/x/7000',
        caption: 'Ramadan launch',
        postedAt: '2026-04-10T12:00:00Z',
        durationSeconds: 12,
        plays: 1200,
        likes: 80,
        comments: 5,
        shares: 2,
        saves: 1,
        hashtags: ['ramadan', 'kayan'],
        thumbnailUrl: 'https://cdn/x.jpg',
      },
    ]);
  });

  it('reads profile stats from authorMeta on any item', async () => {
    const client = makeClient([
      {
        id: '1',
        authorMeta: { fans: 12345, heartCount: 99999, videoCount: 80 },
      },
    ]);
    const scraper = new TikTokScraper(client);
    const profile = await scraper.fetchProfile('kayan_sweets');
    expect(profile).toEqual({ followers: 12345, totalLikes: 99999, totalVideos: 80 });
  });

  it('drops items without an id', async () => {
    const client = makeClient([{ text: 'no id here' }]);
    const scraper = new TikTokScraper(client);
    const posts = await scraper.fetchRecentPosts('@kayan_sweets');
    expect(posts).toEqual([]);
  });
});

describe('InstagramScraper', () => {
  it('falls back to shortCode for externalId + synthesizes a url', async () => {
    const client = makeClient([
      {
        followersCount: 5000,
        postsCount: 300,
      },
      {
        shortCode: 'ABC123',
        caption: 'Hello',
        timestamp: '2026-04-10T10:00:00Z',
        likesCount: 40,
        commentsCount: 3,
        hashtags: ['sweet'],
        displayUrl: 'https://cdn/abc.jpg',
      },
    ]);

    const scraper = new InstagramScraper(client);
    const posts = await scraper.fetchRecentPosts('kayan_sweets');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.externalId).toBe('ABC123');
    expect(posts[0]?.url).toBe('https://www.instagram.com/p/ABC123');
    expect(posts[0]?.hashtags).toEqual(['sweet']);
  });

  it('extracts followersCount from the profile item', async () => {
    const client = makeClient([{ followersCount: 5000, postsCount: 300 }]);
    const scraper = new InstagramScraper(client);
    const profile = await scraper.fetchProfile('@kayan_sweets');
    expect(profile).toEqual({ followers: 5000, totalLikes: null, totalVideos: 300 });
  });
});

describe('SnapchatScraper', () => {
  it('is growth-only — fetchRecentPosts is intentionally absent', () => {
    const client = makeClient([]);
    const scraper = new SnapchatScraper(client);
    // `fetchRecentPosts` is optional on PlatformScraper; Snapchat declines it.
    expect((scraper as { fetchRecentPosts?: unknown }).fetchRecentPosts).toBeUndefined();
  });

  it('returns subscribers + totalViews from the Apify item', async () => {
    const client = makeClient([{ subscribers: 2500, totalViews: 12000, totalStories: 18 }]);
    const scraper = new SnapchatScraper(client);
    const profile = await scraper.fetchProfile('@kayan_sweets');
    expect(profile).toEqual({ followers: 2500, totalLikes: 12000, totalVideos: 18 });
  });

  it('returns all-null profile when the actor comes back empty', async () => {
    const client = makeClient([]);
    const scraper = new SnapchatScraper(client);
    const profile = await scraper.fetchProfile('@kayan_sweets');
    expect(profile).toEqual({ followers: null, totalLikes: null, totalVideos: null });
  });
});
