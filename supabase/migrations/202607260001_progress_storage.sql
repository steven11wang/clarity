-- Clarity progress storage for Supabase/PostgreSQL.
-- The authenticated user's UUID is the owner key everywhere. Email is copied
-- for display/search convenience only; it must never be used as a foreign key.

create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

create unique index users_email_lower_idx on public.users (lower(email));

create table public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  username text,
  display_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (username is null or char_length(username) between 3 and 40)
);

create unique index profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

create table public.score_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_key text not null,
  uploaded_at timestamptz not null default now(),
  file_name text,
  parsing_status text not null default 'confirmed'
    check (parsing_status in ('pending', 'parsed', 'manual_required', 'confirmed', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create table public.domain_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  score_report_id uuid references public.score_reports(id) on delete cascade,
  domain text not null,
  difficulty text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  created_at timestamptz not null default now(),
  unique (user_id, score_report_id, domain)
);

create table public.domain_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  domain text not null,
  entry_level text not null check (entry_level in ('Noobie', 'Adventurer', 'Master')),
  unlocked_level text not null check (unlocked_level in ('Noobie', 'Adventurer', 'Master')),
  character_stage text not null,
  checkpoint_status jsonb not null default '{}'::jsonb,
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, domain)
);

create table public.skill_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  domain text not null,
  skill text not null,
  level text not null check (level in ('Noobie', 'Adventurer', 'Master')),
  completed boolean not null default false,
  completed_at timestamptz,
  remediation jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  question_id_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, domain, skill, level)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_key text not null,
  kind text not null check (kind in ('skill', 'checkpoint', 'repair', 'retake', 'practice')),
  domain text,
  skill text,
  level text check (level is null or level in ('Noobie', 'Adventurer', 'Master')),
  purpose text,
  score integer,
  total integer,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, source_key)
);

create table public.question_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  question_id text not null,
  attempted_at timestamptz not null,
  chosen_answer text not null default '',
  correct boolean not null,
  confidence text,
  attempts_to_correct integer not null default 0,
  payload jsonb not null,
  unique (user_id, attempted_at, question_id)
);

create index question_attempts_user_time_idx
  on public.question_attempts (user_id, attempted_at desc);

create table public.review_queue (
  user_id uuid not null references public.users(id) on delete cascade,
  question_id text not null,
  due_at timestamptz not null,
  stage integer not null,
  reason text not null check (reason in ('miss', 'hidden-error', 'timeout')),
  clears integer not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index review_queue_due_idx on public.review_queue (user_id, due_at)
  where stage >= 0;

create table public.progression_snapshots (
  user_id uuid primary key references public.users(id) on delete cascade,
  schema_version integer not null,
  revision integer not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keep public identity rows in step with Supabase Authentication.
create or replace function public.handle_auth_user_saved()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, created_at, updated_at, last_sign_in_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.created_at, now()),
    now(),
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now(),
    last_sign_in_at = excluded.last_sign_in_at;

  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_saved
  after insert or update of email, last_sign_in_at on auth.users
  for each row execute procedure public.handle_auth_user_saved();

-- Backfill identities if this migration is applied after users already exist.
insert into public.users (id, email, created_at, updated_at, last_sign_in_at)
select id, coalesce(email, ''), created_at, now(), last_sign_in_at
from auth.users
on conflict (id) do nothing;

insert into public.profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (user_id) do nothing;

-- Every browser call uses the anon key plus a signed-in JWT. These policies
-- guarantee that one student can never read or write another student's rows.
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.score_reports enable row level security;
alter table public.domain_results enable row level security;
alter table public.domain_progress enable row level security;
alter table public.skill_progress enable row level security;
alter table public.assessments enable row level security;
alter table public.question_attempts enable row level security;
alter table public.review_queue enable row level security;
alter table public.progression_snapshots enable row level security;

create policy "users_select_self" on public.users for select using (id = auth.uid());
create policy "profiles_manage_self" on public.profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "score_reports_manage_self" on public.score_reports for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "domain_results_manage_self" on public.domain_results for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "domain_progress_manage_self" on public.domain_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "skill_progress_manage_self" on public.skill_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assessments_manage_self" on public.assessments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "question_attempts_manage_self" on public.question_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "review_queue_manage_self" on public.review_queue for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progression_snapshots_manage_self" on public.progression_snapshots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select on public.users to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.score_reports,
  public.domain_results,
  public.domain_progress,
  public.skill_progress,
  public.assessments,
  public.question_attempts,
  public.review_queue,
  public.progression_snapshots
to authenticated;
grant usage, select on all sequences in schema public to authenticated;
