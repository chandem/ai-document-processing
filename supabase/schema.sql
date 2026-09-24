-- AI Document Processing schema (canonical).
-- Apply to the dedicated Supabase project, then ensure Storage bucket `documents` exists (private).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text,
  content_type text,
  file_size bigint,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'completed', 'failed')),
  extracted_text text,
  category text,
  classification_confidence numeric(4, 3),
  summary text,
  structured_data jsonb,
  error_message text,
  retry_count integer not null default 0,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents (user_id);
create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_user_created_idx on public.documents (user_id, created_at desc);

alter table public.documents enable row level security;
revoke all on table public.documents from anon;
grant select, insert, update, delete on table public.documents to authenticated;

drop policy if exists "Users can view their own documents" on public.documents;
drop policy if exists "Users can create their own documents" on public.documents;
drop policy if exists "Users can update their own documents" on public.documents;
drop policy if exists "Users can delete their own documents" on public.documents;

create policy "Users can view their own documents"
  on public.documents for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own documents"
  on public.documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own documents"
  on public.documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own documents"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- processing_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null default 'queued',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'running', 'completed', 'failed')),
  attempt integer not null default 1,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processing_jobs_document_idx on public.processing_jobs (document_id);
create index if not exists processing_jobs_user_created_idx on public.processing_jobs (user_id, created_at desc);
create index if not exists processing_jobs_document_created_idx on public.processing_jobs (document_id, created_at desc);

alter table public.processing_jobs enable row level security;
revoke all on table public.processing_jobs from anon;
grant select, insert, update, delete on table public.processing_jobs to authenticated;

drop policy if exists "Users can view their own processing jobs" on public.processing_jobs;
drop policy if exists "Users can create their own processing jobs" on public.processing_jobs;
drop policy if exists "Users can update their own processing jobs" on public.processing_jobs;
drop policy if exists "Users can delete their own processing jobs" on public.processing_jobs;

create policy "Users can view their own processing jobs"
  on public.processing_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own processing jobs"
  on public.processing_jobs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own processing jobs"
  on public.processing_jobs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own processing jobs"
  on public.processing_jobs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists processing_jobs_set_updated_at on public.processing_jobs;
create trigger processing_jobs_set_updated_at
  before update on public.processing_jobs
  for each row execute function public.set_updated_at();
