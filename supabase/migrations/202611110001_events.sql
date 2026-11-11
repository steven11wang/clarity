-- Clarity product analytics: anonymous funnel events.
--
-- One row per event, written straight from the browser. There is no user id,
-- email, IP address or free text in a row: `anon_id` is a random id the
-- browser makes up and keeps in localStorage, and `path` is only the screen
-- name ("/play"), never a full URL. Visitors who send Do Not Track or Global
-- Privacy Control are not recorded at all (see src/redesign/game/track.ts).
--
-- Anyone may insert; nobody but the dashboard / service role may read. There
-- is deliberately no select, update or delete policy.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,47}$'),
  anon_id text not null check (char_length(anon_id) between 8 and 64),
  session_id text check (char_length(session_id) <= 64),
  path text check (char_length(path) <= 80),
  referrer text check (char_length(referrer) <= 120),
  signed_in boolean not null default false,
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 1024)
);

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant insert on public.events to anon, authenticated;

drop policy if exists "events_insert_anyone" on public.events;
create policy "events_insert_anyone" on public.events
  for insert to anon, authenticated
  with check (true);

create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_name_created_at_idx on public.events (name, created_at desc);

-- The funnel, one row per UTC day. Read it in the SQL editor:
--   select * from public.funnel_daily limit 30;
-- security_invoker keeps the table's row level security in force, so the
-- browser roles cannot read events through the view either.
create or replace view public.funnel_daily
with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(distinct anon_id) filter (where name = 'landing_view') as visitors,
  count(distinct anon_id) filter (where name = 'demo_answer') as tried_demo,
  count(distinct anon_id) filter (where name = 'cta_click') as clicked_play,
  count(distinct anon_id) filter (where name = 'onboard_step' and props ->> 'step' = 'warmup') as finished_onboarding,
  count(distinct anon_id) filter (where name = 'page_turn_in') as turned_in_a_page,
  count(distinct anon_id) filter (where name = 'signin_done') as signed_in,
  count(distinct anon_id) filter (where name = 'day_active' and (props ->> 'day_n')::int >= 1) as came_back,
  count(distinct anon_id) filter (where name = 'day_active' and (props ->> 'day_n')::int >= 7) as came_back_after_a_week
from public.events
group by 1
order by 1 desc;

revoke all on public.funnel_daily from anon, authenticated;
