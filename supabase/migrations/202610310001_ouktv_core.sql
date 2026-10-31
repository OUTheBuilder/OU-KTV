-- OU KTV backend foundation (Supabase/Postgres)
-- Apply this migration in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.ktv_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'Karaoke Room',
  host_name text not null default 'Host',
  status text not null default 'waiting' check (status in ('waiting','playing','closed')),
  now_playing jsonb,
  is_paused boolean not null default false,
  playback_position_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ktv_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ktv_rooms(id) on delete cascade,
  display_name text not null,
  role text not null default 'guest' check (role in ('host','guest','remote')),
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create table if not exists public.ktv_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ktv_rooms(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  requester text not null default 'Guest',
  position integer not null default 0,
  status text not null default 'queued' check (status in ('queued','playing','played','removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.ktv_cheers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.ktv_rooms(id) on delete cascade,
  sender_name text not null default 'Guest',
  created_at timestamptz not null default now()
);

create table if not exists public.ktv_app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.ktv_app_config(key,value) values
 ('app_name','"O|U KTV"'::jsonb),
 ('app_tagline','"Sing together"'::jsonb),
 ('email_login_enabled','false'::jsonb),
 ('default_theme','"neonpop"'::jsonb),
 ('default_skin','"default"'::jsonb)
on conflict (key) do nothing;

create index if not exists ktv_rooms_code_idx on public.ktv_rooms(code);
create index if not exists ktv_queue_room_status_idx on public.ktv_queue(room_id,status,position);
create index if not exists ktv_members_room_idx on public.ktv_room_members(room_id,joined_at);

-- Realtime delivers room/queue changes. Clients receive read-only access;
-- all writes must go through the Edge Function using server-side validation.
alter table public.ktv_rooms enable row level security;
alter table public.ktv_queue enable row level security;
alter table public.ktv_room_members enable row level security;
alter table public.ktv_cheers enable row level security;
alter table public.ktv_app_config enable row level security;

drop policy if exists "Public can read room snapshots" on public.ktv_rooms;
create policy "Public can read room snapshots" on public.ktv_rooms for select to anon, authenticated using (true);
drop policy if exists "Public can read queue" on public.ktv_queue;
create policy "Public can read queue" on public.ktv_queue for select to anon, authenticated using (true);
drop policy if exists "Public can read room members" on public.ktv_room_members;
create policy "Public can read room members" on public.ktv_room_members for select to anon, authenticated using (true);
drop policy if exists "Public can read cheers" on public.ktv_cheers;
create policy "Public can read cheers" on public.ktv_cheers for select to anon, authenticated using (true);
drop policy if exists "Public can read app config" on public.ktv_app_config;
create policy "Public can read app config" on public.ktv_app_config for select to anon, authenticated using (true);

-- Enable Postgres change events for live room updates.
do $$ begin
  alter publication supabase_realtime add table public.ktv_rooms;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.ktv_queue;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

-- Atomic action handler called only by the trusted Edge Function.
create or replace function public.ktv_apply_action(
  p_code text,
  p_action jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ktv_rooms%rowtype;
  a text := coalesce(p_action->>'type','');
  song_id uuid;
  result jsonb;
begin
  select * into r from public.ktv_rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;

  if a = 'add_song' then
    insert into public.ktv_queue(room_id,youtube_id,title,requester,position)
    values (r.id, coalesce(p_action->>'youtube_id',''), coalesce(p_action->>'title','Untitled'),
      coalesce(p_action->>'requester','Guest'),
      (select coalesce(max(position),0)+1 from public.ktv_queue where room_id=r.id and status='queued'));
  elsif a = 'play' then
    update public.ktv_rooms set is_paused=false,status='playing',updated_at=now() where id=r.id;
  elsif a = 'pause' then
    update public.ktv_rooms set is_paused=true,updated_at=now() where id=r.id;
  elsif a = 'stop' then
    update public.ktv_rooms set is_paused=true,status='waiting',now_playing=null,updated_at=now() where id=r.id;
  elsif a = 'next' then
    update public.ktv_queue set status='played' where room_id=r.id and status='playing';
    update public.ktv_queue set status='playing'
      where id=(select id from public.ktv_queue where room_id=r.id and status='queued' order by position,created_at limit 1)
      returning id into song_id;
    if song_id is not null then
      update public.ktv_rooms set now_playing=(select jsonb_build_object('id',youtube_id,'title',title,'requester',requester) from public.ktv_queue where id=song_id),
        status='playing',is_paused=false,updated_at=now() where id=r.id;
    else
      update public.ktv_rooms set now_playing=null,status='waiting',updated_at=now() where id=r.id;
    end if;
  elsif a = 'like' then
    insert into public.ktv_cheers(room_id,sender_name) values(r.id,coalesce(p_action->>'requester','Guest'));
  elsif a = 'remove_song' then
    update public.ktv_queue set status='removed' where id=(p_action->>'queue_id')::uuid and room_id=r.id and status='queued';
  elsif a = 'join' then
    insert into public.ktv_room_members(room_id,display_name,role)
    values(r.id,coalesce(p_action->>'requester','Guest'),case when coalesce((p_action->>'isRemote')::boolean,false) then 'remote' else 'guest' end);
  elsif a = 'leave' then
    update public.ktv_room_members set left_at=now()
      where room_id=r.id and left_at is null and display_name=coalesce(p_action->>'requester','Guest');
  else
    raise exception 'Unsupported action';
  end if;

  select jsonb_build_object(
    'type','ktv',
    'code',r.code,
    'name',r.name,
    'nowPlaying',(select now_playing from public.ktv_rooms where id=r.id),
    'isPaused',(select is_paused from public.ktv_rooms where id=r.id),
    'queue',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'youtube_id',youtube_id,'title',title,'requester',requester,'position',position) order by position,created_at),'[]'::jsonb) from public.ktv_queue where room_id=r.id and status='queued'),
    'guestCount',(select count(*) from public.ktv_room_members where room_id=r.id and left_at is null)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ktv_apply_action(text,jsonb) from public, anon, authenticated;
