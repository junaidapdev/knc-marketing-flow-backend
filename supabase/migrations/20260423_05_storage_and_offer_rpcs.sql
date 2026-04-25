-- ============================================================================
-- Chunk 7: Offers, Shop Activities, Budget + Supabase Storage.
--
--  - Two private buckets for file uploads (shop-activity photos + receipts)
--  - Permissive RLS policies on storage.objects (V1 single-org)
--  - Transactional RPCs for "create offer + its setup task" and
--    "create shop activity + its execute task" so both rows land together.
-- ============================================================================

begin;

-- ---- Storage buckets ------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('shop-activity-photos', 'shop-activity-photos', false),
  ('receipts',             'receipts',             false)
on conflict (id) do nothing;

-- ---- Storage RLS ---------------------------------------------------------
-- V1 is single-org; service_role bypasses RLS anyway (that's what the API
-- uses), but we still grant authenticated users read/write so client-side
-- signed-URL flows work if they ever do direct-to-Storage uploads/downloads.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and policyname = 'mf_authenticated_read'
  ) then
    create policy mf_authenticated_read
      on storage.objects for select to authenticated
      using (bucket_id in ('shop-activity-photos', 'receipts'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and policyname = 'mf_authenticated_insert'
  ) then
    create policy mf_authenticated_insert
      on storage.objects for insert to authenticated
      with check (bucket_id in ('shop-activity-photos', 'receipts'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and policyname = 'mf_authenticated_update'
  ) then
    create policy mf_authenticated_update
      on storage.objects for update to authenticated
      using (bucket_id in ('shop-activity-photos', 'receipts'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and policyname = 'mf_authenticated_delete'
  ) then
    create policy mf_authenticated_delete
      on storage.objects for delete to authenticated
      using (bucket_id in ('shop-activity-photos', 'receipts'));
  end if;
end $$;

-- ---- Offer + setup-task RPC ----------------------------------------------
create or replace function public.create_offer_with_task(
  p_offer jsonb,
  p_task  jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_offer_id uuid;
  v_result   jsonb;
begin
  insert into offer (
    plan_id, brand_id, name, type, branch_ids, start_date, end_date,
    products_text, mechanic_text, budget_amount, assignee_id, status
  )
  values (
    (p_offer->>'plan_id')::uuid,
    (p_offer->>'brand_id')::uuid,
    p_offer->>'name',
    p_offer->>'type',
    coalesce(
      (select array_agg((value)::uuid) from jsonb_array_elements_text(p_offer->'branch_ids')),
      '{}'::uuid[]
    ),
    (p_offer->>'start_date')::date,
    (p_offer->>'end_date')::date,
    p_offer->>'products_text',
    p_offer->>'mechanic_text',
    nullif(p_offer->>'budget_amount','')::numeric,
    (p_offer->>'assignee_id')::uuid,
    coalesce(p_offer->>'status', 'planned')
  )
  returning id into v_offer_id;

  if p_task is not null then
    insert into task (offer_id, assignee_id, due_date, step, status, notes)
    values (
      v_offer_id,
      (p_task->>'assignee_id')::uuid,
      (p_task->>'due_date')::date,
      coalesce(p_task->>'step', 'setup'),
      coalesce(p_task->>'status', 'pending'),
      p_task->>'notes'
    );
  end if;

  select to_jsonb(o) into v_result from offer o where o.id = v_offer_id;
  return v_result;
end;
$$;

-- ---- Shop activity + execute-task RPC ------------------------------------
create or replace function public.create_shop_activity_with_task(
  p_activity jsonb,
  p_task     jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_activity_id uuid;
  v_result      jsonb;
begin
  insert into shop_activity (
    plan_id, branch_id, week_of, type, assignee_id, status, photo_url, notes
  )
  values (
    (p_activity->>'plan_id')::uuid,
    (p_activity->>'branch_id')::uuid,
    (p_activity->>'week_of')::date,
    p_activity->>'type',
    (p_activity->>'assignee_id')::uuid,
    coalesce(p_activity->>'status', 'planned'),
    p_activity->>'photo_url',
    p_activity->>'notes'
  )
  returning id into v_activity_id;

  if p_task is not null then
    insert into task (shop_activity_id, assignee_id, due_date, step, status, notes)
    values (
      v_activity_id,
      (p_task->>'assignee_id')::uuid,
      (p_task->>'due_date')::date,
      coalesce(p_task->>'step', 'execute'),
      coalesce(p_task->>'status', 'pending'),
      p_task->>'notes'
    );
  end if;

  select to_jsonb(sa) into v_result from shop_activity sa where sa.id = v_activity_id;
  return v_result;
end;
$$;

commit;
