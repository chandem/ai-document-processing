-- Align processing_jobs with application code and expand allowed statuses.

-- Allow 'processing' status used by the API background worker
do $$
begin
  alter table public.processing_jobs drop constraint if exists processing_jobs_status_check;
exception
  when undefined_object then null;
end $$;

alter table public.processing_jobs
  add constraint processing_jobs_status_check
  check (status in ('queued', 'processing', 'running', 'completed', 'failed'));

-- Canonical error column name
alter table public.processing_jobs
  add column if not exists error_message text;

-- Copy legacy `error` into error_message if that column existed in some envs
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'processing_jobs'
      and column_name = 'error'
  ) then
    execute 'update public.processing_jobs set error_message = coalesce(error_message, error) where error is not null';
  end if;
end $$;

alter table public.processing_jobs
  add column if not exists updated_at timestamptz not null default now();

alter table public.processing_jobs
  add column if not exists attempt integer not null default 1;

-- documents recovery columns (idempotent)
alter table public.documents
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists processed_at timestamptz,
  add column if not exists structured_data jsonb;
