-- Clarity word bank storage for Supabase/PostgreSQL.

create table if not exists public.word_bank (
  user_id uuid not null references public.users(id) on delete cascade,
  word_id text not null,
  word text not null,
  due_at timestamptz not null,
  stage integer not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

alter table public.word_bank enable row level security;

create policy "word_bank_manage_self" on public.word_bank for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.word_bank to authenticated;
