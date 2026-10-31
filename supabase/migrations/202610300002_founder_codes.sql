-- Founding-member codes (redesign preview; not applied yet).
--
-- A code unlocks the Summer Scholar avatar and the "Founding member" title,
-- once per account. Codes are stored hashed (sha256 of the code upper-cased with
-- everything but letters and digits removed), with a use cap and an end date.
--
--   insert into public.founder_codes (code_hash, label, max_uses, ends_at)
--   values (encode(extensions.digest('YOURCODE', 'sha256'), 'hex'), 'Governor''s School', 300, '2027-01-31');

create table if not exists public.founder_codes (
  code_hash text primary key,
  label text not null,
  max_uses integer not null default 300 check (max_uses > 0),
  uses integer not null default 0,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.founder_redemptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null references public.founder_codes (code_hash),
  redeemed_at timestamptz not null default now()
);

alter table public.founder_codes enable row level security;
alter table public.founder_redemptions enable row level security;

-- nobody reads the codes table from the client
create policy "read own redemption" on public.founder_redemptions
  for select using (auth.uid() = user_id);

create or replace function public.redeem_founder_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_hash text := encode(digest(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), 'sha256'), 'hex');
  v_code public.founder_codes%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'account');
  end if;
  if exists (select 1 from public.founder_redemptions where user_id = v_user) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select * into v_code from public.founder_codes where code_hash = v_hash for update;
  if not found or (v_code.ends_at is not null and v_code.ends_at < now()) then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if v_code.uses >= v_code.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into public.founder_redemptions (user_id, code_hash) values (v_user, v_hash);
  update public.founder_codes set uses = uses + 1 where code_hash = v_hash;
  return jsonb_build_object('ok', true, 'label', v_code.label);
end;
$$;

revoke all on function public.redeem_founder_code(text) from public, anon;
grant execute on function public.redeem_founder_code(text) to authenticated;
