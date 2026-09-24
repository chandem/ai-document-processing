-- Conversation history for multi-turn document Q&A + usage event log

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_document_idx on public.conversations (document_id);
create index if not exists conversations_user_idx on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;
revoke all on table public.conversations from anon;
grant select, insert, update, delete on table public.conversations to authenticated;

create policy "Users can view their own conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);

alter table public.messages enable row level security;
revoke all on table public.messages from anon;
grant select, insert, update, delete on table public.messages to authenticated;

create policy "Users can view their own messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own messages"
  on public.messages for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own messages"
  on public.messages for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_day_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;
revoke all on table public.usage_events from anon;
grant select on table public.usage_events to authenticated;

create policy "Users can view their own usage events"
  on public.usage_events for select to authenticated
  using ((select auth.uid()) = user_id);
