-- ============================================================================
-- Chunk 5: atomic "create calendar entry + task chain" RPC.
--
-- Used by POST /plans/:planId/entries so that auto-generated tasks and the
-- entry they belong to either both land or neither does.
-- ============================================================================

begin;

create or replace function public.create_entry_with_tasks(
  p_entry jsonb,
  p_tasks jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_entry_id uuid;
  v_task     jsonb;
  v_result   jsonb;
begin
  insert into calendar_entry (
    plan_id, brand_id, date, type, platform, title, script, notes, status, template_id
  )
  values (
    (p_entry->>'plan_id')::uuid,
    (p_entry->>'brand_id')::uuid,
    (p_entry->>'date')::date,
    p_entry->>'type',
    p_entry->>'platform',
    p_entry->>'title',
    p_entry->>'script',
    p_entry->>'notes',
    coalesce(p_entry->>'status', 'planned'),
    nullif(p_entry->>'template_id','')::uuid
  )
  returning id into v_entry_id;

  if p_tasks is not null and jsonb_array_length(p_tasks) > 0 then
    for v_task in select * from jsonb_array_elements(p_tasks) loop
      insert into task (
        calendar_entry_id, assignee_id, due_date, step, status, notes
      )
      values (
        v_entry_id,
        (v_task->>'assignee_id')::uuid,
        (v_task->>'due_date')::date,
        v_task->>'step',
        coalesce(v_task->>'status', 'pending'),
        v_task->>'notes'
      );
    end loop;
  end if;

  select to_jsonb(ce) into v_result from calendar_entry ce where ce.id = v_entry_id;
  return v_result;
end;
$$;

comment on function public.create_entry_with_tasks is
  'Insert a calendar entry and its auto-generated task chain atomically. Returns the entry row as jsonb.';

commit;
