-- ============================================================================
-- Chunk 11: Social Media Performance Dashboard — backend foundation.
--
--  - social_account   : which handles the dashboard scrapes
--  - social_snapshots : profile-level growth metrics per sync
--  - social_posts     : per-post engagement (UPSERT on platform+external_id)
--  - social_sync_log  : observability (one row per platform per trigger)
--  - seeded 3 social_account rows for Kayan Sweets
-- ============================================================================

begin;

-- ---- social_account ------------------------------------------------------
create table if not exists social_account (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  handle      text not null,
  brand_id    uuid not null references brand(id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (platform, handle)
);

create index if not exists social_account_brand_idx on social_account (brand_id);

-- ---- social_snapshots ----------------------------------------------------
create table if not exists social_snapshots (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  brand_id      uuid not null references brand(id),
  captured_at   timestamptz not null default now(),
  followers     integer,
  total_likes   bigint,
  total_videos  integer,
  created_at    timestamptz not null default now()
);

create index if not exists social_snapshots_brand_platform_idx
  on social_snapshots (brand_id, platform, captured_at desc);

-- ---- social_posts --------------------------------------------------------
create table if not exists social_posts (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  brand_id          uuid not null references brand(id),
  external_id       text not null,
  url               text,
  caption           text,
  posted_at         timestamptz,
  duration_seconds  integer,
  plays             bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  saves             bigint,
  hashtags          text[] not null default '{}',
  thumbnail_url     text,
  last_synced_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (platform, external_id)
);

create index if not exists social_posts_brand_platform_posted_at_idx
  on social_posts (brand_id, platform, posted_at desc);

-- ---- social_sync_log -----------------------------------------------------
create table if not exists social_sync_log (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null check (platform in ('tiktok', 'instagram', 'snapchat')),
  triggered_by     text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null check (status in ('running', 'success', 'failed')),
  posts_upserted   integer not null default 0,
  error_message    text,
  created_at       timestamptz not null default now()
);

create index if not exists social_sync_log_started_at_idx
  on social_sync_log (started_at desc);

-- ---- RLS -----------------------------------------------------------------
alter table social_account    enable row level security;
alter table social_snapshots  enable row level security;
alter table social_posts      enable row level security;
alter table social_sync_log   enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'social_account', 'social_snapshots', 'social_posts', 'social_sync_log'
  ] loop
    execute format(
      'drop policy if exists %I on %I',
      tbl || '_service_role_all', tbl
    );
    execute format(
      'create policy %I on %I for all to service_role using (true) with check (true)',
      tbl || '_service_role_all', tbl
    );
    execute format(
      'drop policy if exists %I on %I',
      tbl || '_authenticated_all', tbl
    );
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      tbl || '_authenticated_all', tbl
    );
  end loop;
end $$;

-- ---- Seed Kayan handles --------------------------------------------------
insert into social_account (platform, handle, brand_id, is_active)
select v.platform, v.handle, b.id, true
from (values
  ('tiktok',    '@kayan_sweets'),
  ('instagram', '@kayan_sweets'),
  ('snapchat',  '@kayan_sweets')
) as v(platform, handle)
cross join lateral (select id from brand where name = 'Kayan Sweets') b
on conflict (platform, handle) do nothing;

commit;
