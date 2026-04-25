-- ============================================================================
-- Chunk 8: Planning Wizard.
--
--  - wizard_draft jsonb column on plan for resume-mid-wizard persistence
--  - create_plan_from_wizard RPC: creates the plan + template-produced
--    entries/tasks/shared-shoots + offers (with setup tasks) + shop
--    activities (with execute tasks) in one transaction
-- ============================================================================

begin;

alter table plan add column if not exists wizard_draft jsonb;

create or replace function public.create_plan_from_wizard(
  p_plan            jsonb,
  p_shared_shoots   jsonb default '[]'::jsonb,
  p_entries         jsonb default '[]'::jsonb,
  p_offers          jsonb default '[]'::jsonb,
  p_shop_activities jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_plan_id        uuid;
  v_map            jsonb := '{}'::jsonb;
  v_shoot          jsonb;
  v_real_id        uuid;
  v_entry          jsonb;
  v_entry_id       uuid;
  v_task           jsonb;
  v_offer          jsonb;
  v_offer_id       uuid;
  v_activity       jsonb;
  v_activity_id    uuid;
  v_tmp_id         text;
  v_shared_ref     text;
  v_entry_count    int := 0;
  v_task_count     int := 0;
  v_shoot_count    int := 0;
  v_offer_count    int := 0;
  v_activity_count int := 0;
begin
  -- 1. Plan
  insert into plan (month, year, budget_ceiling, status, wizard_draft)
  values (
    (p_plan->>'month')::int,
    (p_plan->>'year')::int,
    nullif(p_plan->>'budget_ceiling','')::numeric,
    coalesce(p_plan->>'status', 'draft'),
    null
  )
  returning id into v_plan_id;

  -- 2. Shared shoot tasks (one per week in shoot_weekly_post_daily mode)
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
      v_task_count  := v_task_count + 1;
    end loop;
  end if;

  -- 3. Calendar entries + their per-entry task chains
  if p_entries is not null then
    for v_entry in select * from jsonb_array_elements(p_entries) loop
      insert into calendar_entry (
        plan_id, brand_id, date, type, platform, title, script, notes, status, template_id
      )
      values (
        v_plan_id,
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

  -- 4. Offers + their setup tasks
  if p_offers is not null then
    for v_offer in select * from jsonb_array_elements(p_offers) loop
      insert into offer (
        plan_id, brand_id, name, type, branch_ids, start_date, end_date,
        products_text, mechanic_text, budget_amount, assignee_id, status
      )
      values (
        v_plan_id,
        (v_offer->>'brand_id')::uuid,
        v_offer->>'name',
        v_offer->>'type',
        coalesce(
          (select array_agg((value)::uuid) from jsonb_array_elements_text(v_offer->'branch_ids')),
          '{}'::uuid[]
        ),
        (v_offer->>'start_date')::date,
        (v_offer->>'end_date')::date,
        v_offer->>'products_text',
        v_offer->>'mechanic_text',
        nullif(v_offer->>'budget_amount','')::numeric,
        (v_offer->>'assignee_id')::uuid,
        coalesce(v_offer->>'status', 'planned')
      )
      returning id into v_offer_id;
      v_offer_count := v_offer_count + 1;

      if v_offer->'task' is not null then
        v_task := v_offer->'task';
        insert into task (offer_id, assignee_id, due_date, step, status, notes)
        values (
          v_offer_id,
          (v_task->>'assignee_id')::uuid,
          (v_task->>'due_date')::date,
          coalesce(v_task->>'step', 'setup'),
          coalesce(v_task->>'status', 'pending'),
          v_task->>'notes'
        );
        v_task_count := v_task_count + 1;
      end if;
    end loop;
  end if;

  -- 5. Shop activities + their execute tasks
  if p_shop_activities is not null then
    for v_activity in select * from jsonb_array_elements(p_shop_activities) loop
      insert into shop_activity (
        plan_id, branch_id, week_of, type, assignee_id, status, photo_url, notes
      )
      values (
        v_plan_id,
        (v_activity->>'branch_id')::uuid,
        (v_activity->>'week_of')::date,
        v_activity->>'type',
        (v_activity->>'assignee_id')::uuid,
        coalesce(v_activity->>'status', 'planned'),
        v_activity->>'photo_url',
        v_activity->>'notes'
      )
      returning id into v_activity_id;
      v_activity_count := v_activity_count + 1;

      if v_activity->'task' is not null then
        v_task := v_activity->'task';
        insert into task (shop_activity_id, assignee_id, due_date, step, status, notes)
        values (
          v_activity_id,
          (v_task->>'assignee_id')::uuid,
          (v_task->>'due_date')::date,
          coalesce(v_task->>'step', 'execute'),
          coalesce(v_task->>'status', 'pending'),
          v_task->>'notes'
        );
        v_task_count := v_task_count + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'planId',                v_plan_id,
    'entriesCreated',        v_entry_count,
    'tasksCreated',          v_task_count,
    'offersCreated',         v_offer_count,
    'shopActivitiesCreated', v_activity_count,
    'sharedShootsCreated',   v_shoot_count
  );
end;
$$;

commit;
