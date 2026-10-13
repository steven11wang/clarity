-- Clarity in-app feedback.
-- Signed-in learners can add a row for themselves and nothing else: there is no
-- select, update or delete policy, so the table is read only from the Supabase
-- dashboard (Table Editor / SQL editor) or with the service role key.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  display_name text,
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  view text,
  page_url text,
  user_agent text,
  viewport text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback_insert_self" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

grant insert on public.feedback to authenticated;

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
