-- Paywall storage for Clarity.
-- Stripe is the source of truth. The webhook edge function (service role) is the
-- only writer; the browser may read its own row and nothing else.

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none'
    check (status in (
      'none', 'incomplete', 'incomplete_expired', 'trialing', 'active',
      'past_due', 'canceled', 'unpaid', 'paused'
    )),
  plan text check (plan is null or plan in ('pro', 'pro_max')),
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Stripe retries a webhook until it gets a 2xx, so every delivery is recorded
-- and replays are dropped instead of re-applied.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

create or replace function public.touch_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_subscription_updated_at();

-- Single definition of "is allowed into the dashboard", so the client gate and
-- any future row-level policy cannot drift apart.
-- The two day grace absorbs webhook retry lag: a period that just rolled over
-- must not lock a paying user out before Stripe's renewal event lands.
create or replace function public.has_active_subscription(target uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = target
      and status in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now() - interval '2 days')
  );
$$;

grant execute on function public.has_active_subscription(uuid) to authenticated;

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

-- Read-only for the owner. No insert/update/delete policy exists for
-- authenticated users, so a browser cannot grant itself a plan. The webhook
-- uses the service role key, which bypasses RLS.
create policy "subscriptions_select_self" on public.subscriptions
  for select using (user_id = auth.uid());
