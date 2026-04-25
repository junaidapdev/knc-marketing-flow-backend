# marketing-flow-api

API for the Kayan Sweets Marketing Flow.

## Tech stack

- Node 20, Express 4
- TypeScript 5 (`strict: true`)
- Supabase (`@supabase/supabase-js`) for DB access
- Zod for validation
- Pino for logging
- Vitest for tests
- ESLint + Prettier

## Setup

```bash
# Install dependencies
npm install

# Copy the env template and fill it in
cp .env.example .env
```

## Environment variables

All env vars are validated at startup by `src/config/env.ts`. Nothing else in
the codebase reads `process.env`.

| Variable                    | Required | Default                  | Notes                                                        |
| --------------------------- | -------- | ------------------------ | ------------------------------------------------------------ |
| `NODE_ENV`                  | no       | `development`            | `development` \| `test` \| `production`                      |
| `PORT`                      | no       | `3000`                   | HTTP port                                                    |
| `LOG_LEVEL`                 | no       | `info`                   | Pino level (`fatal`..`trace`, `silent`)                      |
| `SUPABASE_URL`              | yes (prod) | `http://localhost:54321` | Supabase project URL                                       |
| `SUPABASE_SERVICE_ROLE`     | yes (prod) | placeholder              | Supabase service-role key (server-only; bypasses RLS)      |
| `SUPABASE_PROJECT_REF`      | yes (prod) | placeholder              | Supabase project ref — used by `db:types`                  |

**Never use the Supabase anon key on the backend.** The service role is
required so the API can enforce its own authorization.

See `.env.example`.

## Scripts

```bash
npm run dev        # start with tsx watch
npm run build      # compile TypeScript to dist/
npm start          # run compiled build
npm test           # run Vitest test suite
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run db:check   # verify Supabase connectivity + seed counts
npm run db:types   # regenerate src/types/database.ts from Supabase
npm run db:migrate # apply supabase/migrations/*.sql via Supabase CLI
```

## Database

Schema lives in [`supabase/migrations/`](supabase/migrations/). V1 tables:
`brand`, `branch`, `assignee`, `plan`, `recurring_template`,
`calendar_entry`, `shop_activity`, `offer`, `task`, `budget_entry`.

### Applying the initial migration

Pick whichever matches your workflow:

1. **Supabase CLI (recommended)**

   ```bash
   supabase link --project-ref $SUPABASE_PROJECT_REF
   supabase db push
   ```

2. **Dashboard SQL editor** — paste the contents of
   `supabase/migrations/20260423_v1_initial_schema.sql` into the SQL editor
   and run it.

3. **Any Postgres client** —
   `psql "$DATABASE_URL" -f supabase/migrations/20260423_v1_initial_schema.sql`.

Then verify with `npm run db:check` — expect `brand: 3`, `branch: 12`,
`assignee: 2`.

### Regenerating types

After schema changes, regenerate the types file:

```bash
SUPABASE_ACCESS_TOKEN=<personal-token> npm run db:types
```

`src/lib/supabase.ts` exports the typed `db` client
(`SupabaseClient<Database>`). Use the `TABLES.*` constants from
`src/constants/tables.ts` — do not hardcode table names.

## Social sync cron (Module 4.7)

The scheduled social sync runs in a **Supabase Edge Function** (Deno),
not in this Node API. The Edge Function calls `POST /social/sync` on
the Node API using a shared `SERVICE_TOKEN`, so all scraping and DB
writes stay in one codebase.

Source lives in
[`supabase/functions/social-sync-cron/index.ts`](supabase/functions/social-sync-cron/index.ts).
pg_cron schedule lives in
[`supabase/migrations/20260424_10_social_cron.sql`](supabase/migrations/20260424_10_social_cron.sql).

### One-time deploy

```bash
# 1. Pick (or generate) a strong shared secret and save it in
#    BOTH environments:
export SERVICE_TOKEN="$(openssl rand -hex 32)"
echo "SERVICE_TOKEN=$SERVICE_TOKEN" >> marketing-flow-api/.env

# 2. Push the same secret + your API's public URL into the Edge
#    Function's env.
cd marketing-flow-api
supabase link --project-ref $SUPABASE_PROJECT_REF
supabase secrets set SERVICE_TOKEN=$SERVICE_TOKEN
supabase secrets set API_BASE_URL=https://your-api.example.com

# 3. Deploy the function. `--no-verify-jwt` lets pg_cron invoke it
#    with just a bearer header (pg_net requires one but we don't
#    verify it inside the function).
supabase functions deploy social-sync-cron --no-verify-jwt

# 4. Edit 20260424_10_social_cron.sql: replace <project-ref> with
#    your actual ref and <cron-secret> with any non-empty string,
#    then apply:
supabase db push   # or paste into the dashboard SQL editor

# 5. Verify the schedule is registered and ran.
#    (SQL editor)
#      select * from cron.job where jobname = 'social-sync-daily';
#      select * from cron.job_run_details
#         where jobname = 'social-sync-daily'
#         order by start_time desc limit 5;
```

### Manual admin refresh

`POST /social/refresh[?platform=...]` is the admin-facing alias — same
handler as `/social/sync`, just clearer in logs and UI buttons. It
accepts either a user JWT or the `SERVICE_TOKEN`.

## Folder structure

```
src/
  config/        # env loading + validation (only place that reads process.env)
  constants/     # HTTP status codes, error codes/messages
  middleware/    # requestId, auth, errorHandler
  routes/        # Express routers (one file per resource)
  types/api/     # shared API types (envelope, etc.)
  utils/         # logger, response envelope helpers
  app.ts         # buildApp() — Express app factory (used by tests)
  server.ts      # process entrypoint — boots the server
tests/           # Vitest suites
```

## Response envelope

Every response uses the envelope in `src/types/api/envelope.ts`:

```jsonc
{
  "success": true,
  "data": { /* payload */ },
  "meta": {
    "timestamp": "2026-04-23T12:00:00.000Z",
    "requestId": "uuid"
  }
}
```

Errors:

```jsonc
{
  "success": false,
  "error": { "code": "VALIDATION_FAILED", "message": "...", "details": { } },
  "meta": { "timestamp": "...", "requestId": "..." }
}
```

Use `success(data, meta?)` and `error(code, message, details?, meta?)` from
`src/utils/response.ts`. Do not hand-roll envelopes.

## Health check

```bash
curl http://localhost:3000/health
```

Returns `{ success, data: { status, version, uptime }, meta }` with HTTP 200.
