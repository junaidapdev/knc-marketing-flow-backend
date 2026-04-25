import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const DEFAULT_PORT = 3000;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.string().url().default('http://localhost:54321'),
  SUPABASE_SERVICE_ROLE: z.string().min(1).default('placeholder-service-role-key'),
  SUPABASE_PROJECT_REF: z.string().min(1).default('placeholder-project-ref'),
  APIFY_TOKEN: z.string().min(1).default('placeholder-apify-token'),
  APIFY_TIKTOK_ACTOR_ID: z.string().min(1).default('clockworks~tiktok-scraper'),
  APIFY_IG_ACTOR_ID: z.string().min(1).default('apify~instagram-profile-scraper'),
  APIFY_SNAP_ACTOR_ID: z.string().min(1).default('placeholder-snap-actor'),
  /**
   * Shared secret used by the Supabase Edge Function cron to call the
   * API without a user JWT. Set to a strong random value in prod
   * (`supabase secrets set SERVICE_TOKEN=...`). Empty string disables
   * service-token auth entirely.
   */
  SERVICE_TOKEN: z.string().default(''),
  /**
   * Comma-separated list of origins allowed to call this API in the
   * browser. Empty (default) means "allow all" — fine for local dev,
   * not safe for prod. Set to e.g.
   * `https://marketing.kayansweets.com,https://staging.kayansweets.com`
   * before deploying.
   */
  WEB_ORIGIN: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
