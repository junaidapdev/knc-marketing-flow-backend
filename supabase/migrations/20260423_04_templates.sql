-- ============================================================================
-- Chunk 6: Recurring Templates.
--
--  - Extend calendar_entry.type to include 'engagement' and 'research'
--  - Add task.shared_shoot_id for "shoot weekly, post daily" Snapchat mode
--  - Relax task check so shared shoot tasks (no calendar_entry_id yet) are OK
--  - RPC apply_templates_to_plan(...) inserts weekly shared shoots + entries
--    + per-entry tasks atomically
--  - Seed 8 default templates
-- ============================================================================

begin;

-- ---- 1. Extend calendar_entry.type CHECK ---------------------------------
alter table calendar_entry drop constraint if exists calendar_entry_type_check;
alter table calendar_entry
  add constraint calendar_entry_type_check
  check (type in (
    'snap_story', 'snap_spotlight', 'tiktok_video', 'ig_video', 'ig_story',
    'shop_activity', 'offer', 'shoot', 'engagement', 'research'
  ));

-- ---- 2. Add shared_shoot_id on task --------------------------------------
alter table task
  add column if not exists shared_shoot_id uuid references task(id) on delete set null;

create index if not exists task_shared_shoot_id_idx on task (shared_shoot_id);

-- ---- 3. Relax the "exactly one parent" CHECK -----------------------------
-- Shared shoot tasks are weekly batch work that spans multiple post entries,
-- so they're allowed to have none of calendar_entry_id / offer_id /
-- shop_activity_id set. Regular tasks still must have exactly one.
alter table task drop constraint if exists task_check;
alter table task
  add constraint task_parent_check
  check (num_nonnulls(calendar_entry_id, offer_id, shop_activity_id) <= 1);

-- ---- 4. apply_templates_to_plan RPC --------------------------------------
create or replace function public.apply_templates_to_plan(
  p_plan_id        uuid,
  p_shared_shoots  jsonb default '[]'::jsonb,
  p_entries        jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_map           jsonb := '{}'::jsonb;
  v_shoot         jsonb;
  v_real_id       uuid;
  v_entry         jsonb;
  v_entry_id      uuid;
  v_task          jsonb;
  v_tmp_id        text;
  v_shared_ref    text;
  v_entry_count   int := 0;
  v_task_count    int := 0;
  v_shoot_count   int := 0;
begin
  if not exists (select 1 from plan where id = p_plan_id) then
    raise exception 'plan not found: %', p_plan_id using errcode = '23503';
  end if;

  -- 4a. Insert shared shoot tasks up front so we have stable ids to
  --     reference from per-day post tasks.
  if p_shared_shoots is not null then
    for v_shoot in select * from jsonb_array_elements(p_shared_shoots) loop
      insert into task (
        assignee_id, due_date, step, status, notes, shared_shoot_id, calendar_entry_id
      )
      values (
        (v_shoot->>'assignee_id')::uuid,
        (v_shoot->>'due_date')::date,
        'shoot',
        'pending',
        v_shoot->>'notes',
        null,
        null
      )
      returning id into v_real_id;

      v_tmp_id := v_shoot->>'tmp_id';
      if v_tmp_id is not null then
        v_map := v_map || jsonb_build_object(v_tmp_id, v_real_id::text);
      end if;
      v_shoot_count := v_shoot_count + 1;
    end loop;
  end if;

  -- 4b. Insert entries + their per-entry tasks.
  if p_entries is not null then
    for v_entry in select * from jsonb_array_elements(p_entries) loop
      insert into calendar_entry (
        plan_id, brand_id, date, type, platform, title, script, notes, status, template_id
      )
      values (
        p_plan_id,
        (v_entry->>'brand_id')::uuid,
        (v_entry->>'date')::date,
        v_entry->>'type',
        v_entry->>'platform',
        v_entry->>'title',
        v_entry->>'script',
        v_entry->>'notes',
        coalesce(v_entry->>'status', 'planned'),
        nullif(v_entry->>'template_id','')::uuid
      )
      returning id into v_entry_id;
      v_entry_count := v_entry_count + 1;

      if v_entry->'tasks' is not null then
        for v_task in select * from jsonb_array_elements(v_entry->'tasks') loop
          v_shared_ref := v_task->>'shared_shoot_tmp_id';
          insert into task (
            calendar_entry_id, assignee_id, due_date, step, status, notes, shared_shoot_id
          )
          values (
            v_entry_id,
            (v_task->>'assignee_id')::uuid,
            (v_task->>'due_date')::date,
            v_task->>'step',
            coalesce(v_task->>'status', 'pending'),
            v_task->>'notes',
            case when v_shared_ref is not null then (v_map->>v_shared_ref)::uuid else null end
          );
          v_task_count := v_task_count + 1;
        end loop;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'entryCount', v_entry_count,
    'taskCount', v_task_count,
    'sharedShootCount', v_shoot_count
  );
end;
$$;

comment on function public.apply_templates_to_plan is
  'Bulk-apply recurring templates to a plan. Inserts shared weekly shoot tasks first (so per-day post tasks can reference them), then entries and their task chains, all atomically.';

-- ---- 5. Seed 8 default templates -----------------------------------------
insert into recurring_template (
  name, brand_id, content_type, cadence, days_of_week, default_assignee_id, shoot_mode, is_active
)
select tmpl.name, b.id, tmpl.content_type, tmpl.cadence, tmpl.days_of_week, a.id, tmpl.shoot_mode, true
from (values
  ('Daily Snapchat Story',       'snap_story',     'daily',   null::smallint[],          'Ammar',  'shoot_weekly_post_daily'),
  ('Weekly Snapchat Spotlight',  'snap_spotlight', 'weekly',  array[4]::smallint[],      'Ammar',  'none'),
  ('Weekly TikTok',              'tiktok_video',   'weekly',  array[3]::smallint[],      'Ammar',  'none'),
  ('Weekly Instagram Reel',      'ig_video',       'weekly',  array[0]::smallint[],      'Junaid', 'none'),
  ('Instagram Stories (3x/week)', 'ig_story',      'custom',  array[0,2,4]::smallint[],  'Ammar',  'none'),
  ('Daily DM & Comment Replies', 'engagement',     'daily',   null::smallint[],          'Ammar',  'none'),
  ('Daily Trend Research (30 min)', 'research',    'daily',   null::smallint[],          'Ammar',  'none'),
  ('Weekly Trends Shortlist',    'research',       'weekly',  array[6]::smallint[],      'Ammar',  'none')
) as tmpl(name, content_type, cadence, days_of_week, assignee_name, shoot_mode)
cross join lateral (select id from brand where name = 'Kayan Sweets') b
cross join lateral (select id from assignee where name = tmpl.assignee_name) a
where not exists (
  select 1 from recurring_template rt where rt.name = tmpl.name
);

commit;
