import { env } from '../../config/env';

const APIFY_BASE = 'https://api.apify.com/v2';
const ERROR_BODY_MAX_CHARS = 200;

/**
 * Thin wrapper around Apify's "run actor synchronously and get dataset
 * items" endpoint. Each call blocks until the run finishes and returns
 * the resulting items as parsed JSON.
 *
 * Extracted into its own module so each platform scraper can be unit
 * tested with a mocked client and no network.
 */
export interface ApifyClient {
  runActorAndGetItems<TInput, TItem>(actorId: string, input: TInput): Promise<TItem[]>;
}

class RealApifyClient implements ApifyClient {
  async runActorAndGetItems<TInput, TItem>(actorId: string, input: TInput): Promise<TItem[]> {
    const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Apify actor ${actorId} failed with ${res.status}: ${body.slice(0, ERROR_BODY_MAX_CHARS)}`,
      );
    }
    const json = (await res.json()) as TItem[];
    return Array.isArray(json) ? json : [];
  }
}

export const apifyClient: ApifyClient = new RealApifyClient();
