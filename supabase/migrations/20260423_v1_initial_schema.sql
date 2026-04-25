-- ============================================================================
-- Kayan Sweets Marketing Flow — V1 initial schema
-- Chunk 1 of 15
--
-- Applies:
--   - All V1 tables in FK dependency order
--   - Reference-data seeds (brand, branch, assignee)
--   - Row-Level Security enabled on every table, permissive for V1
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. brand
-- ----------------------------------------------------------------------------
create table if not exists brand (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  is_active    boolean not null default true,
  is_hidden    boolean not null default false,
  accent_color text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. branch
-- ----------------------------------------------------------------------------
create table if not exists branch (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  city                 text not null,
  brand_id             uuid not null references brand(id),
  has_boxed_chocolates boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists branch_brand_id_idx on branch (brand_id);

-- ----------------------------------------------------------------------------
-- 3. assignee
-- ----------------------------------------------------------------------------
create table if not exists assignee (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  role       text not null check (role in ('content_engagement', 'digital_marketing_production')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. plan
-- ----------------------------------------------------------------------------
create table if not exists plan (
  id              uuid primary key default gen_random_uuid(),
  month           smallint not null check (month between 1 and 12),
  year            smallint not null,
  budget_ceiling  numeric(12, 2),
  status          text not null check (status in ('draft', 'published')) default 'draft',
  created_at      timestamptz not null default now(),
  unique (month, year)
);

-- ----------------------------------------------------------------------------
-- 7. recurring_template (created before calendar_entry because of FK)
-- ----------------------------------------------------------------------------
create table if not exists recurring_template (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  brand_id            uuid not null references brand(id),
  content_type        text not null,
  cadence             text not null check (cadence in ('daily', 'weekly', 'monthly', 'custom')),
  days_of_week        smallint[],
  default_assignee_id uuid not null references assignee(id),
  shoot_mode          text check (shoot_mode in ('shoot_daily', 'shoot_weekly_post_daily', 'none')) default 'none',
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. calendar_entry
-- ----------------------------------------------------------------------------
create table if not exists calendar_entry (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plan(id) on delete cascade,
  brand_id    uuid not null references brand(id),
  date        date not null,
  type        text not null check (type in (
                'snap_story', 'snap_spotlight', 'tiktok_video', 'ig_video', 'ig_story',
                'shop_activity', 'offer', 'shoot'
              )),
  platform    text,
  title       text not null,
  script      text,
  notes       text,
  status      text not null check (status in ('planned', 'in_progress', 'ready', 'posted')) default 'planned',
  template_id uuid references recurring_template(id),
  created_at  timestamptz not null default now()
);

create index if not exists calendar_entry_plan_date_idx on calendar_entry (plan_id, date);
create index if not exists calendar_entry_brand_id_idx on calendar_entry (brand_id);

-- ----------------------------------------------------------------------------
-- 8. shop_activity (before task because task references it)
-- ----------------------------------------------------------------------------
create table if not exists shop_activity (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plan(id) on delete cascade,
  branch_id   uuid not null references branch(id),
  week_of     date not null,
  type        text not null check (type in ('sampling', 'display_change', 'tasting', 'promotion_setup', 'other')),
  assignee_id uuid not null references assignee(id),
  status      text not null check (status in ('planned', 'in_progress', 'completed')) default 'planned',
  photo_url   text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists shop_activity_plan_week_idx on shop_activity (plan_id, week_of);

-- ----------------------------------------------------------------------------
-- 9. offer (before task because task references it)
-- ----------------------------------------------------------------------------
create table if not exists offer (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plan(id) on delete cascade,
  brand_id       uuid not null references brand(id),
  name           text not null,
  type           text not null check (type in ('threshold_coupon', 'branch_deal', 'single_product', 'salary_week', 'bundle')),
  branch_ids     uuid[] not null,
  start_date     date not null,
  end_date       date not null,
  products_text  text,
  mechanic_text  text,
  budget_amount  numeric(12, 2),
  assignee_id    uuid not null references assignee(id),
  status         text not null check (status in ('planned', 'live', 'ended')) default 'planned',
  created_at     timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists offer_plan_id_idx on offer (plan_id);

-- ----------------------------------------------------------------------------
-- 6. task (references calendar_entry, offer, shop_activity)
-- ----------------------------------------------------------------------------
create table if not exists task (
  id                 uuid primary key default gen_random_uuid(),
  calendar_entry_id  uuid references calendar_entry(id) on delete cascade,
  offer_id           uuid references offer(id) on delete cascade,
  shop_activity_id   uuid references shop_activity(id) on delete cascade,
  assignee_id        uuid not null references assignee(id),
  due_date           date not null,
  step               text not null check (step in ('script', 'shoot', 'edit', 'post', 'setup', 'execute')),
  status             text not null check (status in ('pending', 'in_progress', 'done', 'skipped')) default 'pending',
  notes              text,
  created_at         timestamptz not null default now(),
  check (num_nonnulls(calendar_entry_id, offer_id, shop_activity_id) = 1)
);

create index if not exists task_assignee_due_idx on task (assignee_id, due_date);

-- ----------------------------------------------------------------------------
-- 10. budget_entry
-- ----------------------------------------------------------------------------
create table if not exists budget_entry (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references plan(id) on delete cascade,
  category           text not null check (category in (
                       'general_marketing', 'influencers', 'in_shop_activities',
                       'product_offers', 'camera_production'
                     )),
  amount_sar         numeric(12, 2) not null check (amount_sar >= 0),
  date               date not null,
  description        text,
  branch_id          uuid references branch(id),
  linked_entity_type text check (linked_entity_type in ('calendar_entry', 'offer', 'shop_activity')),
  linked_entity_id   uuid,
  receipt_url        text,
  created_at         timestamptz not null default now()
);

create index if not exists budget_entry_plan_date_idx on budget_entry (plan_id, date);

-- ============================================================================
-- Row-Level Security
--
-- V1 is single-user; service-role key bypasses RLS anyway, but we enable RLS
-- and add permissive policies so the schema is multi-user-ready and the anon
-- role is explicitly scoped later.
-- ============================================================================

alter table brand              enable row level security;
alter table branch             enable row level security;
alter table assignee           enable row level security;
alter table plan               enable row level security;
alter table recurring_template enable row level security;
alter table calendar_entry     enable row level security;
alter table shop_activity      enable row level security;
alter table offer              enable row level security;
alter table task               enable row level security;
alter table budget_entry       enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'brand', 'branch', 'assignee', 'plan', 'recurring_template',
    'calendar_entry', 'shop_activity', 'offer', 'task', 'budget_entry'
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

-- ============================================================================
-- Seeds
-- ============================================================================

-- Brands
insert into brand (name, is_active, is_hidden, accent_color) values
  ('Kayan Sweets', true,  false, '#D4A017'),
  ('FryBee',       false, false, '#E74C3C'),
  ('Kayan Online', false, true,  '#1ABC9C')
on conflict (name) do nothing;

-- Branches (all 12 under Kayan Sweets)
insert into branch (name, city, brand_id, has_boxed_chocolates)
select v.name, v.city, b.id, v.has_boxed
from (values
  ('Al Rusaifah',  'Makkah', true),
  ('Al Awali',     'Makkah', true),
  ('Al Shouqiyah', 'Makkah', false),
  ('Al Marwa',     'Jeddah', false),
  ('Al Salama',    'Jeddah', true),
  ('Al Hamdaniyya','Jeddah', false),
  ('Al Khumra',    'Jeddah', false),
  ('Al Sanabil',   'Jeddah', true),
  ('Al Salhiyaa',  'Jeddah', false),
  ('Abhur',        'Jeddah', true),
  ('Al Shaddha',   'Madina', true),
  ('Al Haramain',  'Other',  true)
) as v(name, city, has_boxed)
cross join lateral (select id from brand where name = 'Kayan Sweets') b
on conflict (brand_id, name) do nothing;

-- Assignees
insert into assignee (name, role) values
  ('Ammar',  'content_engagement'),
  ('Junaid', 'digital_marketing_production')
on conflict (name) do nothing;

commit;
