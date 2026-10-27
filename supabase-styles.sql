-- Suvoz: caption styles that users make on the AI subtitles page. Paste this whole file into Supabase > SQL Editor > Run. Safe to run again.
create table if not exists public.caption_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists caption_styles_user_idx on public.caption_styles (user_id);
alter table public.caption_styles enable row level security;   -- nobody reads it directly

-- The styles of one user, newest first.
create or replace function public.styles_list(p_user uuid)
returns table (id uuid, name text, settings jsonb, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, name, settings, created_at from public.caption_styles
   where user_id = p_user order by created_at desc;
$$;

-- Saves a new style (p_id null) or changes one of the user's own styles.
-- Returns the style id, or null when the user already has p_max styles (or the style is not theirs).
create or replace function public.styles_save(p_user uuid, p_id uuid, p_name text, p_settings jsonb, p_max integer)
returns uuid
language plpgsql security definer set search_path = public as $$
declare out_id uuid;
begin
  if p_id is not null then
    update public.caption_styles set name = left(p_name, 40), settings = p_settings, updated_at = now()
     where id = p_id and user_id = p_user returning id into out_id;
    return out_id;
  end if;
  if (select count(*) from public.caption_styles where user_id = p_user) >= p_max then return null; end if;
  insert into public.caption_styles (user_id, name, settings) values (p_user, left(p_name, 40), p_settings) returning id into out_id;
  return out_id;
end;
$$;

-- Removes one style, only if it belongs to the user. Returns the id, or null.
create or replace function public.styles_remove(p_user uuid, p_id uuid)
returns uuid
language sql security definer set search_path = public as $$
  delete from public.caption_styles where user_id = p_user and id = p_id returning id;
$$;

revoke all on function public.styles_list(uuid) from public, anon, authenticated;
revoke all on function public.styles_save(uuid, uuid, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.styles_remove(uuid, uuid) from public, anon, authenticated;
grant execute on function public.styles_list(uuid) to service_role;
grant execute on function public.styles_save(uuid, uuid, text, jsonb, integer) to service_role;
grant execute on function public.styles_remove(uuid, uuid) to service_role;
