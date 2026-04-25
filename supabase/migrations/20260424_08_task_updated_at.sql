-- ============================================================================
-- Chunk 10: track task status changes.
--
-- Adds `task.updated_at` so the Notifications "Recent activity" feed can
-- surface tasks that were completed or skipped in the last 24h.
-- ============================================================================

begin;

alter table task add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists task_set_updated_at on task;
create trigger task_set_updated_at
  before update on task
  for each row execute function public.touch_task_updated_at();

create index if not exists task_updated_at_idx on task (updated_at desc);

commit;
