-- Suvoz: free-trial accounting. Paste this whole file into Supabase > SQL Editor > Run.
-- Trial size: 1800 characters (about 2 minutes of audio). To change it, replace 1800 in the two functions below and run again.

create table if not exists public.trial_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used integer not null default 0,
  created_at timestamptz not null default now()
);

-- Nobody can read or write this table directly. Only the two functions below can touch it.
alter table public.trial_usage enable row level security;

-- How many trial characters the signed-in user has left.
create or replace function public.trial_left()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare u integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.trial_usage (user_id) values (auth.uid()) on conflict do nothing;
  select used into u from public.trial_usage where user_id = auth.uid();
  return greatest(1800 - u, 0);
end;
$$;

-- Use n trial characters. Returns the characters left, or -1 if there are not enough.
create or replace function public.trial_use(n integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare u integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if n is null or n <= 0 or n > 10000 then raise exception 'bad amount'; end if;
  insert into public.trial_usage (user_id) values (auth.uid()) on conflict do nothing;
  update public.trial_usage
     set used = used + n
   where user_id = auth.uid() and used + n <= 1800
  returning used into u;
  if u is null then return -1; end if;
  return 1800 - u;
end;
$$;

revoke all on function public.trial_left() from public, anon;
revoke all on function public.trial_use(integer) from public, anon;
grant execute on function public.trial_left() to authenticated;
grant execute on function public.trial_use(integer) to authenticated;
