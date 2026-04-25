// Supabase Edge Function — runs in Deno, NOT in the Node API runtime.
//
// Purpose: daily cron entrypoint for Module 4.7. pg_cron fires an HTTP
// POST at this function's URL; we then call the Node API's
// POST /social/sync using the shared SERVICE_TOKEN so all scraping and
// DB writes stay in a single source of business logic.
//
// Deploy:
//   supabase functions deploy social-sync-cron --no-verify-jwt
//   supabase secrets set API_BASE_URL=https://api.kayan-pulse.example
//   supabase secrets set SERVICE_TOKEN=<long random string>
//
// pg_cron is wired in `supabase/migrations/20260424_10_social_cron.sql`.
// The migration writes the exact URL for THIS function; update
// `<project-ref>` there before running it against your project.

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — this file runs in Deno; the Node TS config in this repo
// doesn't know about Deno globals. Type-checked by the Supabase CLI.

const REQUEST_TIMEOUT_MS = 60_000;

interface EdgeEnv {
  API_BASE_URL: string;
  SERVICE_TOKEN: string;
}

function readEnv(): EdgeEnv {
  const apiBaseUrl = Deno.env.get('API_BASE_URL');
  const serviceToken = Deno.env.get('SERVICE_TOKEN');
  if (!apiBaseUrl) throw new Error('API_BASE_URL not configured');
  if (!serviceToken) throw new Error('SERVICE_TOKEN not configured');
  return { API_BASE_URL: apiBaseUrl, SERVICE_TOKEN: serviceToken };
}

async function callSync(env: EdgeEnv, platform: string | null): Promise<unknown> {
  const url = new URL('/social/sync', env.API_BASE_URL);
  if (platform) url.searchParams.set('platform', platform);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        `Upstream /social/sync returned ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  const startedAt = new Date().toISOString();

  let env: EdgeEnv;
  try {
    env = readEnv();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message, startedAt }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Optional: allow narrowing to one platform via `?platform=tiktok`
  // (useful for manual one-off triggers during dev).
  const reqUrl = new URL(req.url);
  const platform = reqUrl.searchParams.get('platform');

  try {
    const summary = await callSync(env, platform);
    return new Response(JSON.stringify({ ok: true, startedAt, summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, startedAt, error: message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
