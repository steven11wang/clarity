-- Water-drop purchases for the redesign's shop (10 drops = $1).
-- Stripe is the source of truth for money. The drops-webhook edge function
-- (service role) is the only writer; a student may read their own rows and
-- nothing else, so a browser cannot grant itself drops.
--
-- Not applied yet: review, then `supabase db push` once Stripe is set up.

create table public.drop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  pack_id text not null,
  drops integer not null check (drops > 0),
  amount_total integer not null check (amount_total >= 0),
  currency text not null default 'usd',
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drop_purchases_user_idx
  on public.drop_purchases (user_id, created_at);

create index drop_purchases_payment_intent_idx
  on public.drop_purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Reuses the trigger function from 202608260001_subscription_paywall.sql.
create trigger drop_purchases_touch_updated_at
  before update on public.drop_purchases
  for each row execute function public.touch_subscription_updated_at();

alter table public.drop_purchases enable row level security;

-- Read-only for the owner. No insert/update/delete policy exists for
-- authenticated users; the webhook's service role key bypasses RLS.
create policy "drop_purchases_select_self" on public.drop_purchases
  for select using (user_id = auth.uid());
