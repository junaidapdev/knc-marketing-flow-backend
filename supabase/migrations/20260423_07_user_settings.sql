-- ============================================================================
-- Chunk 9i: user_settings table.
--
-- One row per user. For V1 we only store a Claude API key. The row is
-- created lazily on first read, so there's no seed step here.
-- ============================================================================

begin;

create table if not exists user_settings (
  user_id         uuid primary key,
  claude_api_key  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table user_settings enable row level security;

-- Service role bypasses RLS — the API is where enforcement happens. We add
-- a permissive authenticated policy for symmetry with the rest of the
-- schema (see chunk 1).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings_service_role_all'
  ) then
    create policy user_settings_service_role_all
      on user_settings for all to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings'
      and policyname = 'user_settings_authenticated_all'
  ) then
    create policy user_settings_authenticated_all
      on user_settings for all to authenticated using (true) with check (true);
  end if;
end $$;

commit;
