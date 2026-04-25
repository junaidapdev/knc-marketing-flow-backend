# Project Log

Append a short entry for every chunk that lands. Newest entries at the top.

## 2026-04-24 — Chunk 12 complete — Scheduled social sync

Wires up daily cron + admin refresh endpoint without duplicating
business logic.

- Env: added `SERVICE_TOKEN` to the Zod schema (default empty so
  unconfigured deployments explicitly opt out of service-token
  auth). Seeded `SERVICE_TOKEN=test-service-token` in
  `vitest.config.ts` so tests can exercise the service-token path.
- `src/middleware/authOrService.ts` — gate-kept by either a valid
  Supabase user JWT **or** an exact-match `SERVICE_TOKEN` bearer.
  On service match, attaches a synthetic
  `{ id: '000…0001', email: 'service@marketing-flow.local' }`
  principal so downstream code (e.g. `triggered_by`) stays uniform.
- `src/routes/social.ts` refactored: router-level
  `requireAuthOrService` middleware, shared `handleSync` handler
  mounted at both `/social/sync` and `/social/refresh`. The latter
  is the admin-facing alias so UIs can call a clearly-named URL.
- `app.ts`: `socialRouter` moved **before** the global `requireAuth`
  so the JWT middleware doesn't short-circuit the service-token
  fallback.
- Edge Function:
  `supabase/functions/social-sync-cron/index.ts` (Deno/TS) reads
  `API_BASE_URL` + `SERVICE_TOKEN` from the Supabase secrets store,
  POSTs to `/social/sync` with a 60s timeout, returns `{ ok,
  startedAt, summary | error }`. It deliberately does **not** touch
  the DB — the Node API remains the single source of business logic.
- Migration
  `supabase/migrations/20260424_10_social_cron.sql`:
  - Idempotent `pg_cron` schedule `social-sync-daily` at `0 3 * * *`
    UTC (~06:00 Saudi).
  - Unschedules any prior job with the same name before
    rescheduling so the file is re-runnable.
  - Placeholder markers for `<project-ref>` and `<cron-secret>` are
    documented inline.
- README gains a full deploy-the-cron runbook (secrets, function
  deploy, migration edit + push, verification queries).
- Tests (8 new in `tests/socialAuth.test.ts`):
  - Service-token path accepts without hitting Supabase Auth.
  - Mismatched bearer falls through to JWT and 401s when that
    fails too.
  - Real user JWT still works (fallback path).
  - `/social/refresh` returns the same summary shape as
    `/social/sync` and accepts both auth types.
  - 422 on invalid `platform` query value.
  - Empty bearer (`Authorization: Bearer `) still rejects.

### 5-day stability log

Tracked in Supabase dashboard → `cron.job_run_details`. Template
for the ops log to fill in post-deploy:

```
| date        | run_id | status    | posts_upserted | notes              |
|-------------|--------|-----------|----------------|--------------------|
| 2026-04-25  | …      | succeeded | 42             | first scheduled run |
| 2026-04-26  | …      | succeeded | 47             | —                  |
| 2026-04-27  | …      | succeeded | 51             | —                  |
| 2026-04-28  | …      | succeeded | 49             | —                  |
| 2026-04-29  | …      | succeeded | 53             | —                  |
```

Intentional-failure test procedure: rotate `APIFY_TOKEN` to an
invalid value, trigger `/social/refresh`, confirm `social_sync_log`
rows land with `status='failed'` and a readable `error_message`,
then restore the token. Logged here once executed.

All gates green: `typecheck`, `lint`, `test` (139/139 across 21 files).

## 2026-04-24 — Chunk 11 complete — Social Dashboard backend foundation

Module 4.7 part 1: four new tables, three scrapers, one orchestrator,
one endpoint.

- Migration `supabase/migrations/20260424_09_social.sql` creates
  `social_account`, `social_snapshots`, `social_posts`, and
  `social_sync_log`. `social_posts` has `unique (platform,
  external_id)` — the UPSERT key for re-syncs. RLS on all four with
  the usual service_role + authenticated policies. Seeds three
  Kayan Sweets handles (`@kayan_sweets` on TikTok / Instagram /
  Snapchat).
- Env: added `APIFY_TOKEN`, `APIFY_TIKTOK_ACTOR_ID`,
  `APIFY_IG_ACTOR_ID`, `APIFY_SNAP_ACTOR_ID` to `.env.example` + the
  Zod schema.
- `constants/platforms.ts` — `Platform` options, human labels,
  `DEFAULT_POST_FETCH_LIMIT`. Added `TABLES.SOCIAL_*` entries.
- Domain types: `Platform`, `ProfileSnapshot`, `PostData`,
  `SocialAccount`, `SocialSnapshot`, `SocialPost`, `SocialSyncLog`.
- `PlatformScraper` interface — `fetchProfile` required,
  `fetchRecentPosts` optional. Snapchat declines the post method at
  the type level.
- `services/scrapers/`:
  - `apifyClient.ts` — thin wrapper around Apify's
    `run-sync-get-dataset-items` endpoint. Truncates error bodies
    to 200 chars so failure messages stay useful without dumping
    full HTML into logs.
  - `tiktokScraper.ts` — maps `authorMeta` profile stats +
    per-post engagement; normalizes mixed-shape hashtags (objects
    or strings); drops items without an `id`.
  - `instagramScraper.ts` — falls back to `shortCode` for
    `externalId` and synthesizes a `https://www.instagram.com/p/…`
    URL when the actor omits it.
  - `snapchatScraper.ts` — profile-only per V1 spec;
    intentionally has no `fetchRecentPosts`.
  - `index.ts` — default singleton map for the three scrapers.
- `services/socialSyncService.ts` orchestrator:
  - One `social_sync_log` row per platform per trigger, with
    `status='running'` at start and `success`/`failed` at finish
    (no dangling `running` rows because each try/catch wraps a
    single platform).
  - Per-platform try/catch so a TikTok crash never takes Instagram
    or Snapchat down with it.
  - When no active `social_account` exists for a platform, a
    failed log with `SOCIAL_ACCOUNT_NOT_FOUND` is still written —
    honest observability about what was attempted.
  - `upsertPosts` uses `onConflict: 'platform,external_id'` so a
    second sync updates engagement without duplicating rows, and
    `created_at` stays at its original value (we only write
    `last_synced_at`).
  - Exposes a `scrapers` injection point so tests can supply
    fakes.
- Route: `POST /social/sync?platform=…` with Zod-validated query.
  `triggered_by` captures `req.user.email`.
- Errors: added `SOCIAL_ACCOUNT_NOT_FOUND`, `SOCIAL_SYNC_FAILED`.
- Tests (14 new across two files):
  - `scrapers.test.ts` — 8 cases. Each scraper mapped correctly
    from a representative Apify item; TikTok drops id-less rows;
    IG synthesizes the URL; Snapchat is proven post-less at the
    type level *and* handles empty actor output.
  - `socialSync.test.ts` — 6 cases. No-account → failed log;
    happy-path success w/ `posts_upserted`; mixed run where
    TikTok fails but IG + Snap succeed; route 401 without a
    token; route success w/ fetch-spy stubbing Apify; route 422
    on invalid platform query param.

All gates green: `typecheck`, `lint`, `test` (131/131 across 20 files).

## 2026-04-24 — Chunk 10 support — /notifications + task updated_at

V1 (non-social) is **COMPLETE** for the API.

- Migration
  `supabase/migrations/20260424_08_task_updated_at.sql` adds
  `task.updated_at timestamptz not null default now()`, a
  `before update` trigger (`touch_task_updated_at`), and a
  `task_updated_at_idx` index. That lets the Recent-activity feed
  cheaply filter tasks completed/skipped in the last 24h.
- `task` row / insert / update types now include `updated_at`.
- `src/services/notificationService.ts` returns a live
  `NotificationFeed`:
  - `overdue` — pending tasks with `due_date < today`
  - `dueToday` — pending tasks with `due_date = today`
  - `recent` — tasks with status in (done, skipped) and
    `updated_at >= now() − 24h`, newest first, capped at 20
  - `counts: { overdue, dueToday, recent, total }` — `total` is
    overdue + dueToday so the UI badge never counts completed items.
  Three separate queries instead of one RPC — keeps each list
  paginatable when V2 needs it.
- `GET /notifications` wired into `app.ts`.
- Tests (3 in `tests/notifications.test.ts`): full-feed happy path
  with counts, 401 without a token, empty-bucket response.

All gates green: `typecheck`, `lint`, `test` (117/117 across 18 files).

## 2026-04-23 — Chunk 9i support — user_settings + /settings

Small backend addition supporting the frontend Settings page.

- Migration `supabase/migrations/20260423_07_user_settings.sql` creates
  `user_settings (user_id uuid primary key, claude_api_key text,
  created_at, updated_at)` with RLS enabled and the usual
  service_role / authenticated policies.
- Added `TABLES.USER_SETTINGS`; typed the new table's Row / Insert /
  Update in `Database`.
- `settingsService`:
  - `getSettingsForUser(userId)` — lazily inserts an empty row on
    first read.
  - `updateSettingsForUser(userId, input)` — upserts on `user_id`.
  - Both return a **redacted** `UserSettings` DTO where
    `claude_api_key` is collapsed to `claudeApiKeySet: boolean`, so the
    raw key is never echoed back to the client after save.
- Schema `schemas/settings.ts` — `partial().refine()` rejects empty
  bodies with 422 `VALIDATION_FAILED`.
- Route `routes/settings.ts`:
  - `GET /settings` — returns current user's (redacted) settings.
  - `PATCH /settings` — updates; accepts `claudeApiKey: string | null`.
  - Both scoped to `req.user.id` (throws `UNAUTHORIZED` if absent).
- Tests (4 in `tests/settings.test.ts`): returns redacted settings
  when a row exists, lazily creates on first read, PATCH updates +
  still redacts the response, PATCH null clears the key, empty-body
  422.
- Gates green: `typecheck`, `lint`, `test` (114/114 across 17 files).

## 2026-04-23 — Chunk 8 complete — planning wizard orchestration

Single atomic "submit wizard" endpoint that creates a plan + its
template-produced entries/tasks/shared-shoots + offers (with setup
tasks) + shop activities (with execute tasks) in one transaction, plus
per-plan JSONB draft persistence.

- Migration `supabase/migrations/20260423_06_wizard.sql`:
  - Adds `plan.wizard_draft jsonb` (nullable) for resume-mid-wizard.
  - Adds `public.create_plan_from_wizard(p_plan, p_shared_shoots,
    p_entries, p_offers, p_shop_activities)` — inserts the plan, then
    shared shoots (tmp_id → uuid map in jsonb), then entries + their
    tasks (substituting `shared_shoot_tmp_id` refs), then offers +
    optional setup tasks, then shop activities + optional execute
    tasks. Returns `{ planId, entriesCreated, tasksCreated,
    offersCreated, shopActivitiesCreated, sharedShootsCreated }`.
- DB types updated: `plan.wizard_draft: Json | null` on Row/Insert/
  Update plus the new RPC added to `Database['public'].Functions`.
- `src/schemas/wizard.ts`:
  - `wizardSubmitSchema` reuses `createOfferSchema.innerType()` and
    `createShopActivitySchema` (omitting `planId` since the wizard
    creates it inline).
  - `wizardDraftSchema` — all keys optional + `.strict()` so corrupt
    unknown fields can't poison `plan.wizard_draft`.
- `src/services/wizardService.ts`:
  - `submitWizard(input)` resolves role assignees once, optionally
    runs the Chunk 6 template applicator over the requested template
    ids (404 `TEMPLATE_NOT_FOUND` for any unresolved), builds offer
    setup tasks dated `startDate − 1` with the production role as
    default, builds shop-activity execute tasks on `weekOf`, then
    fires the single `create_plan_from_wizard` RPC.
  - Per-offer `INVALID_DATE_RANGE` enforcement before the RPC.
  - `saveWizardDraft` / `getWizardDraft` / `clearWizardDraft`.
- `planService.updatePlan` now clears `wizard_draft` when `status`
  moves to `'published'`, matching the spec's "draft cleared on
  final publish" rule.
- Routes: `POST /plans/wizard`, `GET /plans/:id/wizard-draft`,
  `PATCH /plans/:id/wizard-draft`. `wizardRouter` registered **before**
  `plansRouter` in `app.ts` so `/plans/wizard` doesn't get misrouted
  to `PATCH /plans/:id` (which would 422 on the uuid guard).
- Tests (8 new, 109 total / 16 files, all green): submit-wizard
  happy-path integration test (2 templates + 3 offers + 4 activities →
  35 entries, 5 shared shoots); exact-payload check for an offer's
  setup task dated `startDate − 1`; 404 on missing template id; 422
  `INVALID_DATE_RANGE` when `endDate < startDate`; draft GET/PATCH
  round-trip; 404 on missing plan; `.strict()` rejection of unknown
  draft keys.

All gates green: `npm run typecheck`, `npm run lint`, `npm test`
(109/109).

## 2026-04-23 — Chunk 7 complete — offers, shop activities, budget + storage

Closes out the V1 backend business-logic surface.

- Migration `supabase/migrations/20260423_05_storage_and_offer_rpcs.sql`:
  - Creates two private Storage buckets: `shop-activity-photos` and
    `receipts`.
  - Adds permissive `authenticated` RLS policies on `storage.objects`
    for both buckets (service-role bypasses RLS; this is here for
    future client-direct flows).
  - Adds `public.create_offer_with_task(p_offer, p_task)` and
    `public.create_shop_activity_with_task(p_activity, p_task)` so
    each entity + its auto-generated task lands atomically.
- Domain + DB types: `Offer`, `ShopActivity`, `BudgetEntry`,
  `BudgetDashboard`; added both new RPCs to
  `Database['public'].Functions`.
- Schemas: create/update/listQuery for all three + a
  `photoUploadUrlSchema`. Offer create refuses `endDate < startDate`
  at the schema layer (→ 422 `VALIDATION_FAILED`); partial updates
  re-check in the service to emit the explicit
  `INVALID_DATE_RANGE` code.
- Services:
  - `offerService.createOffer` resolves the default assignee via the
    `digital_marketing_production` role when unspecified, builds a
    setup task dated `startDate − 1`, and fires the RPC.
  - `shopActivityService.createShopActivity` same pattern with an
    `execute` task on `weekOf`.
  - `shopActivityService.createPhotoUploadUrl` 404s on missing
    activity, else returns `{ uploadUrl, path, publicUrl }` from
    `storageService.createSignedUpload(bucket, prefix)`.
  - `budgetService` — CRUD plus a **pure** `aggregateBudget(rows,
    previousMonthRows, ceiling)` used by `getBudgetDashboard(planId)`.
    Dashboard loads the plan (404 `PLAN_NOT_FOUND` if missing), the
    current plan's rows, then the preceding-month plan's rows if
    present (wrapping year on January). Returns
    `{ totalSpent, byCategory, vsLastMonth, ceilingUsedPercent }`.
- Routes wired in `app.ts`:
  - `/offers` — list/get/create/update/delete.
  - `/shop-activities` — same + `POST /:id/photo-upload-url`.
  - `/budget-entries` — same + `GET /budget-entries/dashboard`
    (registered before the `:id` route so the exact match wins).
- Errors: added `OFFER_NOT_FOUND`, `SHOP_ACTIVITY_NOT_FOUND`,
  `BUDGET_ENTRY_NOT_FOUND`, `INVALID_DATE_RANGE`,
  `STORAGE_UPLOAD_FAILED`.
- Supabase test mock extended: `db.storage.from(bucket)` now exposes
  `createSignedUploadUrl` and `createSignedUrl` mocks that return
  deterministic `https://storage.test/…` URLs.
- Tests (18 new, 101 total / 15 files, all green):
  - `budgetAggregate.test.ts` — pure aggregation (category grouping,
    `ceilingUsedPercent` with 0/null ceilings, `vsLastMonth` delta
    with normal and zero previous totals).
  - `offers.test.ts` — creates an offer with a setup task on
    `startDate − 1`, honors explicit `assigneeId`, rejects
    `endDate < startDate`, list filters, 404/204 on delete.
  - `shopActivities.test.ts` — create → `execute` task on `weekOf`;
    photo-upload-url returns both URLs and 404s on a missing
    activity.
  - `budgetEntries.test.ts` — create 201, dashboard with prev-month
    delta + ceiling percent, dashboard without prev-month, and 404
    when the plan is missing.

All gates green: `npm run typecheck`, `npm run lint`, `npm test`
(101/101).

## 2026-04-23 — Chunk 6 complete — recurring templates

Templates CRUD + a batch "apply templates to a plan" operation with
proper Snapchat "shoot weekly, post daily" semantics.

- Migration `supabase/migrations/20260423_04_templates.sql`:
  - Extends `calendar_entry.type` CHECK to include `engagement` and
    `research`.
  - Adds `task.shared_shoot_id uuid references task(id) on delete set null`
    + index.
  - Relaxes the task "exactly one parent" CHECK from `= 1` to `<= 1` so
    weekly shared-shoot tasks can exist without a `calendar_entry_id`
    (they span multiple per-day post entries).
  - Adds `public.apply_templates_to_plan(p_plan_id, p_shared_shoots,
    p_entries)` which inserts shared shoots first, builds a
    `tmp_id → real uuid` jsonb map, then inserts entries + their tasks
    (substituting `shared_shoot_tmp_id` refs with the real uuid). All
    atomic. Returns `{ entryCount, taskCount, sharedShootCount }`.
  - Seeds all 8 default templates for Kayan Sweets (Ammar/Junaid).
- Domain:
  - `CalendarEntryType` gains `engagement` and `research`; `Task` gains
    `sharedShootId`.
  - New `RecurringTemplate` domain type.
- Schemas: `createRecurringTemplateSchema` rejects weekly/custom cadence
  without `daysOfWeek`; `updateRecurringTemplateSchema` refuses empty
  bodies; `applyTemplatesSchema` requires ≥1 template id.
- Task defaults: added `EXECUTE_CHAIN` and mapped engagement/research to
  a single content_engagement `execute` task.
- `src/services/templateApplicator.ts` — pure module:
  - `datesForTemplate(template, plan)` — handles daily/weekly/custom/
    monthly, using `0=Sun..6=Sat` day-of-week semantics.
  - `buildApplyPlanForTemplate({ template, plan, assigneesByRole })` —
    returns `{ sharedShoots, entries }`. Standard path uses
    `TASK_CHAIN_BY_ENTRY_TYPE`; `shoot_weekly_post_daily` emits one shoot
    per week (Sunday of that week, clamped into the plan month) keyed by
    `tmp_id`, plus one post entry per day linked via
    `shared_shoot_tmp_id`.
  - `mergeApplyPlans([...])` concatenates results across multiple
    templates.
- `src/services/recurringTemplateService.ts`:
  - CRUD (`list`, `get`, `create`, `update`, `delete`) with 404
    `TEMPLATE_NOT_FOUND` on misses.
  - `applyTemplatesToPlan(planId, { templateIds })` loads the plan,
    fetches the templates, rejects any missing ids up-front (404), runs
    the applicator for each, merges, and fires `apply_templates_to_plan`
    once.
- Routes: `/templates` CRUD + `POST /plans/:planId/apply-templates`.
- Errors: added `TEMPLATE_NOT_FOUND`.
- Tests (83 total, all green): 19 new across two files:
  - `templateApplicator.test.ts` (8 cases) — date computation for all
    four cadences, the video-chain path (weekly TikTok × 5), engagement
    `execute` emission, and the Snapchat shoot-weekly/post-daily path
    (5 shoots clamped to the plan month, 30 post entries, correct
    `shared_shoot_tmp_id` back-reference).
  - `templates.test.ts` (11 cases) — list/create/update/delete happy
    + error paths, weekly-without-daysOfWeek 422, and the integration
    test that applies Daily Snap + Weekly TikTok + IG Stories to a
    30-day plan and asserts the exact `(shared_shoots.length,
    entries.length)` payload.

All gates green: `npm run typecheck`, `npm run lint`, `npm test`
(83/83).

## 2026-04-23 — Chunk 5 complete — task chain auto-generation

`POST /plans/:planId/entries` now auto-creates a role-aware task chain in
the same transaction as the entry it belongs to.

- New migration `supabase/migrations/20260423_03_entry_with_tasks_rpc.sql`
  defines `public.create_entry_with_tasks(p_entry jsonb, p_tasks jsonb)` —
  inserts the `calendar_entry`, iterates the `tasks` array, and returns
  the entry row as jsonb. Added to `Database['public'].Functions` so the
  typed `db.rpc(...)` call stays strict.
- `src/constants/taskDefaults.ts` — `TASK_CHAIN_BY_ENTRY_TYPE` map (video
  types → 4-step chain, story types → single content_engagement `post`,
  `shoot` → single production `shoot`, `shop_activity`/`offer` → []) plus
  `TASK_STATUS_TRANSITIONS` for the state machine.
- `src/services/taskChainBuilder.ts` — **pure** function `buildTaskChain`
  that takes `{ entryType, entryDate, assigneesByRole }` and returns
  `PlannedTask[]` with due dates computed via UTC day arithmetic. Bails
  with `[]` when `shootWeeklyPostDaily` is set, with a `TODO(chunk-6)`
  pointing to the recurring-template scheduler.
- `src/services/taskService.ts`:
  - `resolveAssigneesByRole()` picks the first active assignee per role
    and caches the result for 5 minutes. Exposes
    `clearAssigneeRoleCache()` for tests. Throws
    `ROLE_ASSIGNEE_MISSING` when a required role has no active assignee.
  - `listTasks({ assigneeId?, dueDate?, status?, planId? })`. The
    `planId` filter resolves via the parent `calendar_entry` table.
  - `listTasksDueToday()` groups by `assigneeId` → `Task[]`.
  - `updateTaskStatus()` enforces the state machine (pending →
    in_progress|skipped, in_progress → done|skipped, done is terminal,
    skipped → pending), raising 422 `INVALID_TASK_TRANSITION` otherwise.
- `calendarEntryService.createPlanEntry` now composes
  `assertPlanCoversDate` → `resolveAssigneesByRole` → `buildTaskChain` →
  `create_entry_with_tasks` RPC, so the entry and its chain land
  atomically. Bulk-create via `POST /plans` still skips tasks — that
  endpoint is the reference-data seed path.
- Routes: `GET /tasks`, `GET /tasks/today`, `PATCH /tasks/:id`, wired in
  `app.ts` behind auth. `/tasks/today` sits before `/tasks` so the exact
  match wins over the dynamic route.
- Errors: added `TASK_NOT_FOUND`, `INVALID_TASK_TRANSITION`,
  `ROLE_ASSIGNEE_MISSING`.
- Tests (22 new, 64 total / 9 files, all green):
  - `taskChainBuilder.test.ts` — every entry type, month-boundary
    arithmetic, shop/offer emit nothing, `shootWeeklyPostDaily`
    short-circuits.
  - `tasks.test.ts` — list filters, `/tasks/today` grouping, all six
    state-machine transitions (valid + invalid), and 404 / 422 paths.
  - `entries.test.ts` expanded: the TikTok-entry integration test
    asserts the exact 4-task RPC payload (steps + dates + assignees),
    plus a `snap_story` path that emits the single content-engagement
    post task.

All gates green: `npm run typecheck`, `npm run lint`, `npm test`
(64/64).

## 2026-04-23 — Chunk 4 complete — plans + calendar entries CRUD

Full REST surface for plans and calendar entries, with a transactional
"create plan + entries" RPC.

- New migration `supabase/migrations/20260423_02_plan_rpc.sql` creates
  `public.create_plan_with_entries(month, year, budget_ceiling, entries jsonb)`.
  The function inserts the plan and iterates over `entries`, raising
  SQLSTATE 22023 when any entry's date falls outside the plan
  month/year — the surrounding transaction rolls back, so the call is
  all-or-nothing.
- Domain types: `Plan` + `PlanWithEntryCount` in `types/domain/plan.ts`,
  `CalendarEntry` in `types/domain/calendarEntry.ts`.
- Zod schemas with `create`, `update`, and (for entries) `listQuery`
  variants; the update plan schema refuses empty bodies.
- Services:
  - `planService`: `listPlans`, `getPlan` (adds entry count),
    `createPlan` (auto-switches to the RPC when `entries` is present),
    `updatePlan`, `deletePlan` (refuses non-draft plans → 409),
    `assertPlanCoversDate` (shared guard for entry-month checks).
    Maps Postgres `23505` → 409 `PLAN_DUPLICATE_MONTH` and `22023` from the
    RPC → 422 `ENTRY_DATE_OUT_OF_PLAN`.
  - `calendarEntryService`: `listPlanEntries`, `createPlanEntry`,
    `getEntry`, `updateEntry`, `deleteEntry`. Create and date-changing
    updates both run through `assertPlanCoversDate`.
  - Row→domain mapping lives in `calendarEntryMapper.ts` so both services
    share it without cyclic imports.
- Routes:
  - `GET    /plans`, `GET /plans/:id`, `POST /plans`, `PATCH /plans/:id`,
    `DELETE /plans/:id`
  - `GET    /plans/:planId/entries`, `POST /plans/:planId/entries`,
    `PATCH  /entries/:id`, `DELETE /entries/:id`
  - Correct status codes: 200 reads/updates, 201 creates, 204 deletes,
    404 not-found, 409 conflict, 422 validation/rule violation.
- Error catalog: added `PLAN_NOT_FOUND`, `PLAN_ALREADY_PUBLISHED`,
  `PLAN_DUPLICATE_MONTH`, `ENTRY_NOT_FOUND`, `ENTRY_DATE_OUT_OF_PLAN`.
- `Database` type now includes the `create_plan_with_entries` RPC signature
  so the typed client stays end-to-end strict (no `any`).
- Supabase test mock rewritten as a generic chainable proxy that records
  every method call per table, supports `single`/`maybeSingle` terminals,
  lets tests queue sequential results via `queueResults(...)`, and handles
  `db.rpc(...)` with a separate result slot.
- Tests: 25 new tests (15 for plans, 10 for entries) covering every
  endpoint's happy path and the key error paths (401, 404, 409, 422,
  duplicate month, date-out-of-plan for both direct inserts and RPC, and
  date-changing patches). Total now 42/42 across 7 files.

All gates green: `npm run typecheck`, `npm run lint`, `npm test` (42/42).

## 2026-04-23 — Chunk 2 complete — auth + reference endpoints

Auth middleware and read-only reference data (brands, branches, assignees).

- `requireAuth` now verifies the Supabase JWT via `db.auth.getUser(token)`.
  On success: attaches `req.user: { id, email }` and calls `next()`. On
  failure: responds `401` with `UNAUTHORIZED` (missing header),
  `INVALID_TOKEN` (verification failed), or `TOKEN_EXPIRED` (when the
  Supabase error message signals expiry).
- Express `Request` declaration merging consolidated into
  `src/types/express/index.d.ts` — removed the inline blocks from
  `requestId.ts` and `auth.ts`.
- Domain types (one per file) in `src/types/domain/`: `Brand`, `Branch`,
  `Assignee`, `AuthenticatedUser`.
- Services in `src/services/` (`brandService`, `branchService`,
  `assigneeService`) own the `snake_case` → `camelCase` mapping from
  Supabase rows to domain shapes; routes never see raw DB rows.
- Zod query-param schemas in `src/schemas/` with a boolean-from-string
  helper so `?includeInactive=true` parses correctly.
- Routes:
  - `GET /me` — echoes `req.user`.
  - `GET /brands?includeInactive=<bool>` — lists active, non-hidden brands.
  - `GET /branches?brandId=<uuid>&city=<str>&includeInactive=<bool>` —
    filtered branch list; invalid `brandId` → 422 `VALIDATION_FAILED`.
  - `GET /assignees?includeInactive=<bool>`.
- `app.ts` now applies `requireAuth` to everything except `/health`.
- Error codes: added `INVALID_TOKEN`, `TOKEN_EXPIRED` to `ERRORS`.
- Tests: 17 passing across 5 files. Covers unauthenticated (401),
  invalid-token, expired-token, and authenticated happy-paths for every
  new endpoint, plus `brandId`/`city` filter behavior. Supabase is mocked
  via a thenable query-builder stub in `tests/helpers/supabaseMock.ts`
  (uses `vi.hoisted` to play nicely with `vi.mock` hoisting).
- Health-route test updated: unknown paths now return 401 without a token
  and 404 when authenticated, both asserted.

All gates green: `npm run typecheck`, `npm run lint`, `npm test` (17/17).

## 2026-04-23 — Chunk 1 complete — schema + seeds live

Database schema and Supabase foundation.

- Migration `supabase/migrations/20260423_v1_initial_schema.sql` creates
  every V1 table in FK-dependency order: `brand`, `branch`, `assignee`,
  `plan`, `recurring_template`, `calendar_entry`, `shop_activity`, `offer`,
  `task`, `budget_entry`. Includes all CHECKs, FKs, and supporting indexes
  (`calendar_entry(plan_id, date)`, `shop_activity(plan_id, week_of)`,
  `task(assignee_id, due_date)`, `budget_entry(plan_id, date)`, etc.).
- RLS enabled on every table with permissive `service_role` +
  `authenticated` policies — schema-ready for multi-user, unchanged behavior
  for V1 (service-role key bypasses RLS).
- Seeds: 3 brands (Kayan Sweets active, FryBee/Kayan Online inactive), all
  12 Kayan branches across Makkah/Jeddah/Madina/Other with the correct
  `has_boxed_chocolates` flags, 2 assignees (Ammar/Junaid).
- Env: replaced `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` with
  `SUPABASE_SERVICE_ROLE` + `SUPABASE_PROJECT_REF`. Backend never touches
  the anon key.
- `src/lib/supabase.ts` exports a typed `db: SupabaseClient<Database>`.
  Auth refresh + session persistence disabled (backend is stateless).
- `src/types/database.ts` — authoritative Database type mirroring the
  schema (shape matches `supabase gen types typescript` output). Helpers
  `TableRow<T>`, `TableInsert<T>`, `TableUpdate<T>` for call sites.
- `src/constants/tables.ts` — `TABLES.*` constants; no magic table names.
- Errors: added `DB_ERROR`, `DB_CONNECTION_FAILED`.
- Scripts: `npm run db:check` (smoke-tests connectivity + seed counts),
  `npm run db:types` (regenerates types from Supabase),
  `npm run db:migrate` (Supabase CLI `db push`).
- README documents three ways to apply the migration plus the regen flow.
- `typecheck` now runs against `tsconfig.eslint.json` so scripts/ are
  type-checked too.

Application of the migration and `db:check` against a real Supabase project
is pending network access to the project. All local gates pass:
`npm run typecheck`, `npm run lint`, `npm test`.

## 2026-04-23 — Chunk 0A complete

Foundation + engineering standards.

- Scaffolded `marketing-flow-api/` with Node 20 + Express 4 + TypeScript 5
  (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`).
- `src/config/env.ts` validates env with Zod and exports a frozen typed
  `env`. All other code reads from it — no `process.env` elsewhere.
- Response envelope: `ApiResponse<T>` in `src/types/api/envelope.ts`;
  `success()` / `error()` helpers in `src/utils/response.ts`.
- `src/constants/httpStatus.ts` (named HTTP codes) and
  `src/constants/errors.ts` (seeded with `VALIDATION_FAILED`, `UNAUTHORIZED`,
  `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`).
- Middleware: `requestId` (adds `x-request-id`), `auth` (stub — real
  Supabase JWT verification in a later chunk), `errorHandler` (envelope + Zod
  + `HttpError`).
- Logger: Pino — silent in `test`, pretty in `development`, JSON in
  `production`.
- `GET /health` returns `{ success, data: { status, version, uptime }, meta }`
  using the standard envelope and `OK` from the HTTP status constants.
- Vitest + Supertest: `tests/health.test.ts` asserts the envelope shape,
  request-ID propagation, and the 404 envelope.
- Tooling: ESLint (`@typescript-eslint/no-explicit-any` = error, `no-console`
  = warn, `no-magic-numbers` configured), Prettier, `.gitignore` excluding
  ad-hoc markdown, `.env.example`.
- Scripts: `dev`, `build`, `start`, `test`, `lint`, `typecheck`.
- `CLAUDE.md` documents the 12 architecture decisions.

No business logic, routes, or Supabase calls beyond `/health` — those land in
later chunks.
