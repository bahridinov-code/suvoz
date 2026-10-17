-- Suvoz: plan changes (upgrade now, downgrade later, cancel, resume). Paste this whole file into Supabase > SQL Editor > Run.
-- Run it AFTER supabase-stripe.sql. Safe to run again.

-- Now also tells the server which subscription, plan and end date a person has.
create or replace function public.sub_info(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare s record;
begin
  select * into s from public.subscriptions where user_id = p_user;
  if not found then return jsonb_build_object('exists', false, 'active', false, 'customer', null, 'subscription', null, 'plan', null, 'period_end', null); end if;
  return jsonb_build_object('exists', true, 'active', s.period_end > now() and s.stripe_subscription_id is not null,
                            'customer', s.stripe_customer_id, 'subscription', s.stripe_subscription_id,
                            'plan', s.plan, 'period_end', s.period_end);
end;
$$;

-- Upgrade right now: the new plan and its size apply immediately. Minutes already used stay used, so the person gets the difference.
create or replace function public.change_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare lim integer;
begin
  lim := case lower(p_plan)
    when 'starter' then 27000
    when 'creator' then 108000
    when 'pro' then 360000
    when 'business' then 2700000
    else null end;
  if lim is null then raise exception 'unknown plan'; end if;
  update public.subscriptions
     set plan = lower(p_plan), chars_limit = lim, updated_at = now()
   where user_id = p_user and period_end > now();
  if not found then return 'no plan'; end if;
  return 'ok';
end;
$$;

revoke all on function public.sub_info(uuid) from public, anon, authenticated;
revoke all on function public.change_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.sub_info(uuid) to service_role;
grant execute on function public.change_plan(uuid, text) to service_role;
