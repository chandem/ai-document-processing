alter table public.documents
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists processed_at timestamptz,
  add column if not exists structured_data jsonb;

alter table public.processing_jobs
  add column if not exists attempt integer not null default 1;

create index if not exists processing_jobs_user_created_idx
  on public.processing_jobs (user_id, created_at desc);

create index if not exists processing_jobs_document_created_idx
  on public.processing_jobs (document_id, created_at desc);
