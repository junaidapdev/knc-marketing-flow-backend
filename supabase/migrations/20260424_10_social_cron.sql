-- ============================================================================
-- Chunk 12: schedule the social sync Edge Function via pg_cron.
--
-- This migration:
--   1. Ensures the `pg_cron` and `pg_net` extensions are available.
--   2. Replaces any prior `social-sync-daily` schedule so re-running this
--      file is idempotent.
--   3. Schedules a single POST to the Edge Function URL every day at
--      03:00 UTC (≈ 06:00 Saudi). The Edge Function calls the Node API's
--      /social/sync with the shared SERVICE_TOKEN.
--
-- ❗ Before running, replace the TWO placeholders below:
--   - <project-ref>     your Supabase project reference
--   - <cron-secret>     any bearer Supabase will accept. For Supabase
--                        Edge Functions deployed with `--no-verify-jwt`
--                        the header is ignored but `pg_net` still wants
--                        a value; use the anon key or any non-empty
--                        string.
--
-- Verify:
--   select * from cron.job where jobname = 'social-sync-daily';
--   select * from cron.job_run_details
--     where jobname = 'social-sync-daily' order by start_time desc limit 5;
-- ============================================================================

begin;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Idempotent: remove any prior version of this schedule.
do $$
declare
  existing bigint;
begin
  select jobid into existing from cron.job where jobname = 'social-sync-daily';
  if existing is not null then
    perform cron.unschedule(existing);
  end if;
end $$;

select cron.schedule(
  'social-sync-daily',
  '0 3 * * *',
  $$
    select net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/social-sync-cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <cron-secret>',
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);

commit;
