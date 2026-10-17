-- Suvoz: saves feedback sent from the "Send feedback" page. Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to run again. Read the messages in Supabase > Table Editor > feedback (change "status" to "done" when handled).

create table if not exists public.feedback (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  email text not null,
  kind text not null,
  message text not null,
  page text,
  lang text,
  plan text,
  agent text,
  status text not null default 'new'
);
alter table public.feedback enable row level security;   -- no policies: only the server (secret key) can use it

create or replace function public.add_feedback(p_user uuid, p_email text, p_kind text, p_message text, p_page text, p_lang text, p_plan text, p_agent text)
returns void
language sql
security definer
set search_path = public
as $$ insert into public.feedback (user_id, email, kind, message, page, lang, plan, agent) values (p_user, p_email, p_kind, p_message, p_page, p_lang, p_plan, p_agent); $$;

revoke all on function public.add_feedback(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.add_feedback(uuid, text, text, text, text, text, text, text) to service_role;
