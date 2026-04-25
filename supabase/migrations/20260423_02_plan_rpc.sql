-- ============================================================================
-- Chunk 4: transactional "create plan with entries" RPC.
--
-- Creates a plan and (optionally) its calendar entries in one atomic call.
-- Rejects entries whose date falls outside the plan's month/year so a
-- client bug can never insert misaligned rows even if schema-level CHECKs
-- are added later.
-- ============================================================================

begin;

create or replace function public.create_plan_with_entries(
  p_month          int,
  p_year           int,
  p_budget_ceiling numeric,
  p_entries        jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_plan_id uuid;
  v_entry   jsonb;
  v_date    date;
begin
  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'invalid month: %', p_month
      using errcode = '22023';
  end if;
  if p_year is null then
    raise exception 'year is required' using errcode = '22023';
  end if;

  insert into plan (month, year, budget_ceiling, status)
  values (p_month, p_year, p_budget_ceiling, 'draft')
  returning id into v_plan_id;

  if p_entries is not null and jsonb_array_length(p_entries) > 0 then
    for v_entry in select * from jsonb_array_elements(p_entries) loop
      v_date := (v_entry->>'date')::date;

      if extract(month from v_date)::int <> p_month
         or extract(year from v_date)::int <> p_year then
        raise exception 'entry date % is outside plan %/%', v_date, p_month, p_year
          using errcode = '22023';
      end if;

      insert into calendar_entry (
        plan_id, brand_id, date, type, platform, title, script, notes, status, template_id
      )
      values (
        v_plan_id,
        (v_entry->>'brand_id')::uuid,
        v_date,
        v_entry->>'type',
        v_entry->>'platform',
        v_entry->>'title',
        v_entry->>'script',
        v_entry->>'notes',
        coalesce(v_entry->>'status', 'planned'),
        nullif(v_entry->>'template_id','')::uuid
      );
    end loop;
  end if;

  return v_plan_id;
end;
$$;

comment on function public.create_plan_with_entries is
  'Create a plan and its calendar entries atomically. Entries must fall within the plan month/year.';

commit;
