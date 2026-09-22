-- AI Document Processing initial schema.
-- Apply only to the dedicated AI Document Processing Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text,
  content_type text,
  file_size bigint,
  status text not null default 'uploaded' check (status in ('uploaded','processing','completed','failed')),
  extracted_text text,
  category text,
  classification_confidence numeric(4,3),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_status_idx on public.documents(status);
alter table public.documents enable row level security;
revoke all on table public.documents from anon;
grant select, insert, update, delete on table public.documents to authenticated;

create policy "Users can view their own documents" on public.documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own documents" on public.documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own documents" on public.documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own documents" on public.documents for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists processing_jobs_document_idx on public.processing_jobs(document_id);
alter table public.processing_jobs enable row level security;
revoke all on table public.processing_jobs from anon;
grant select, insert, update, delete on table public.processing_jobs to authenticated;

create policy "Users can view their own processing jobs" on public.processing_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own processing jobs" on public.processing_jobs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own processing jobs" on public.processing_jobs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own processing jobs" on public.processing_jobs for delete to authenticated using ((select auth.uid()) = user_id);
