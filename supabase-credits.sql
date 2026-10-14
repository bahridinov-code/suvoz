-- Suvoz: paid plans and minutes. Paste this whole file into Supabase > SQL Editor > Run.
-- Run it AFTER supabase-setup.sql (which you already did). Safe to run again.
-- 1 minute of audio = 900 characters.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null,
  chars_limit integer not null,
  used integer not null default 0,
  period_end timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;   -- nobody reads it directly

-- Returns {"plan": "...", "left": <characters left>} for the signed-in user.
-- An active paid plan is used first. Otherwise the free trial.
create or replace function public.credits_left()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare s record; u integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into s from public.subscriptions
   where user_id = auth.uid() and period_end > now();
  if found then
    return jsonb_build_object('plan', s.plan, 'left', greatest(s.chars_limit - s.used, 0));
  end if;
  return jsonb_build_object('plan', 'free', 'left', public.trial_left());
end;
$$;

-- Uses n characters. Returns the characters left, or -1 if there are not enough.
create or replace function public.credits_use(n integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare s record; l integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if n is null or n <= 0 or n > 10000 then raise exception 'bad amount'; end if;
  select * into s from public.subscriptions
   where user_id = auth.uid() and period_end > now();
  if found then
    update public.subscriptions
       set used = used + n, updated_at = now()
     where user_id = auth.uid() and used + n <= chars_limit
     returning chars_limit - used into l;
    if l is null then return -1; end if;
    return l;
  end if;
  return public.trial_use(n);
end;
$$;

revoke all on function public.credits_left() from public, anon;
revoke all on function public.credits_use(integer) from public, anon;
grant execute on function public.credits_left() to authenticated;
grant execute on function public.credits_use(integer) to authenticated;

-- YOU use this (SQL Editor only) to give a customer a plan. Stripe will do it automatically later.
-- Example:  select public.grant_plan('someone@example.com', 'creator');
-- Plans: starter 30 min, creator 120 min, pro 400 min, business 3000 min. Lasts 31 days. Minutes reset to full.
create or replace function public.grant_plan(user_email text, plan_name text, days integer default 31)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid; lim integer;
begin
  select id into uid from auth.users where lower(email) = lower(user_email);
  if uid is null then return 'no such user'; end if;
  lim := case lower(plan_name)
    when 'starter' then 27000
    when 'creator' then 108000
    when 'pro' then 360000
    when 'business' then 2700000
    else null end;
  if lim is null then return 'unknown plan: use starter, creator, pro or business'; end if;
  insert into public.subscriptions (user_id, plan, chars_limit, used, period_end)
  values (uid, lower(plan_name), lim, 0, now() + make_interval(days => days))
  on conflict (user_id) do update
    set plan = excluded.plan, chars_limit = excluded.chars_limit, used = 0,
        period_end = excluded.period_end, updated_at = now();
  return 'ok: ' || lower(plan_name) || ' until ' || (now() + make_interval(days => days))::text;
end;
$$;
revoke all on function public.grant_plan(text, text, integer) from public, anon, authenticated;
