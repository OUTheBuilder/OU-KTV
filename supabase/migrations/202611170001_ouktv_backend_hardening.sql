-- Supabase hardening and behavior fixes for the initial OU KTV backend.
-- Safe to apply after 202610310001_ouktv_core.sql.

alter table public.ktv_rooms add column if not exists host_token_hash text;

create or replace function public.ktv_apply_action(
  p_code text,
  p_action jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.ktv_rooms%rowtype;
  a text := coalesce(p_action->>'type','');
  supplied_hash text;
  song_id uuid;
  song_youtube_id text;
  song_title text;
  song_requester text;
  result jsonb;
begin
  if p_action is null or jsonb_typeof(p_action) <> 'object' then
    raise exception 'Invalid action';
  end if;
  select * into r from public.ktv_rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;

  if a in ('play','pause','stop','next','remove_song','reorder','now_playing') then
    if r.host_token_hash is null or coalesce(p_action->>'host_token','') = '' then
      raise exception 'Host permission required';
    end if;
    supplied_hash := encode(digest(convert_to(p_action->>'host_token','UTF8'),'sha256'),'hex');
    if supplied_hash <> r.host_token_hash then raise exception 'Host permission required'; end if;
  end if;

  if a = 'add_song' then
    song_youtube_id := coalesce(p_action->>'youtube_id','');
    song_title := coalesce(p_action->>'title','');
    song_requester := coalesce(nullif(p_action->>'requester',''),'Guest');
    if song_youtube_id !~ '^[A-Za-z0-9_-]{11}$' or length(song_title) not between 1 and 200 then
      raise exception 'Invalid song selection';
    end if;
    if r.now_playing is null then
      update public.ktv_rooms set
        now_playing=jsonb_build_object('youtube_id',song_youtube_id,'title',song_title,'requester',left(song_requester,40)),
        is_paused=false,status='playing',updated_at=now()
      where id=r.id;
    else
      insert into public.ktv_queue(room_id,youtube_id,title,requester,position)
      values(r.id,song_youtube_id,song_title,left(song_requester,40),
        (select coalesce(max(position),0)+1 from public.ktv_queue where room_id=r.id and status='queued'));
    end if;
  elsif a = 'play' then
    update public.ktv_rooms set is_paused=false,status=case when now_playing is null then 'waiting' else 'playing' end,updated_at=now() where id=r.id;
  elsif a = 'pause' then
    update public.ktv_rooms set is_paused=true,updated_at=now() where id=r.id;
  elsif a = 'stop' then
    update public.ktv_rooms set is_paused=true,status='waiting',now_playing=null,updated_at=now() where id=r.id;
  elsif a = 'next' then
    update public.ktv_queue set status='played' where room_id=r.id and status='playing';
    update public.ktv_queue set status='playing'
      where id=(select id from public.ktv_queue where room_id=r.id and status='queued' order by position,created_at limit 1)
      returning id,youtube_id,title,requester into song_id,song_youtube_id,song_title,song_requester;
    if song_id is null then
      update public.ktv_rooms set now_playing=null,status='waiting',is_paused=true,updated_at=now() where id=r.id;
    else
      update public.ktv_rooms set now_playing=jsonb_build_object('youtube_id',song_youtube_id,'title',song_title,'requester',song_requester),
        status='playing',is_paused=false,updated_at=now() where id=r.id;
    end if;
  elsif a = 'like' or a = 'cheer' then
    insert into public.ktv_cheers(room_id,sender_name) values(r.id,left(coalesce(nullif(p_action->>'requester',''),'Guest'),40));
  elsif a = 'remove_song' then
    update public.ktv_queue set status='removed' where id=coalesce(p_action->>'queue_id',p_action->>'song_id')::uuid and room_id=r.id and status='queued';
  elsif a = 'reorder' then
    if jsonb_typeof(p_action->'items') <> 'array' or jsonb_array_length(p_action->'items') > 200 then raise exception 'Invalid queue update'; end if;
    update public.ktv_queue q set position=ordered.position
    from (select (item->>'id')::uuid as id, ordinality::integer as position
      from jsonb_array_elements(p_action->'items') with ordinality as x(item,ordinality)) ordered
    where q.id=ordered.id and q.room_id=r.id and q.status='queued';
  elsif a = 'join' then
    insert into public.ktv_room_members(room_id,display_name,role)
    values(r.id,left(coalesce(nullif(p_action->>'requester',''),'Guest'),40),
      case when coalesce((p_action->>'isRemote')::boolean,false) then 'remote' else 'guest' end);
  elsif a = 'leave' then
    update public.ktv_room_members set left_at=now()
      where room_id=r.id and left_at is null and display_name=left(coalesce(nullif(p_action->>'requester',''),'Guest'),40);
  elsif a = 'now_playing' then
    if p_action->'nowPlaying' is not null and p_action->'nowPlaying' <> 'null'::jsonb then
      song_youtube_id := p_action->'nowPlaying'->>'youtube_id';
      if song_youtube_id !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'Invalid now-playing item'; end if;
    end if;
    update public.ktv_rooms set now_playing=p_action->'nowPlaying',updated_at=now() where id=r.id;
  else
    raise exception 'Unsupported action';
  end if;

  select jsonb_build_object(
    'type','ktv','code',r.code,'name',r.name,
    'nowPlaying',(select now_playing from public.ktv_rooms where id=r.id),
    'isPaused',(select is_paused from public.ktv_rooms where id=r.id),
    'queue',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'youtube_id',youtube_id,'title',title,'requester',requester,'position',position) order by position,created_at),'[]'::jsonb)
      from public.ktv_queue where room_id=r.id and status='queued'),
    'guestCount',(select count(*) from public.ktv_room_members where room_id=r.id and left_at is null)
  ) into result;
  return result;
end;
$$;

revoke all on function public.ktv_apply_action(text,jsonb) from public, anon, authenticated;
grant execute on function public.ktv_apply_action(text,jsonb) to service_role;
