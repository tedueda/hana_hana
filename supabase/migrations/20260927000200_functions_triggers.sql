-- 補助関数・トリガー・RPC
-- 設計書: docs/hanahana/04_supabase_db_design.md §4

-- ---------------------------------------------------------------------------
-- 補助関数 (RLS から利用)
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

create or replace function admin_role() returns admin_role_t
language sql stable security definer set search_path = public as $$
  select role from admin_users where user_id = auth.uid();
$$;

create or replace function is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and status = 'active'
      and deleted_at is null
      and (suspended_until is null or suspended_until < now())
  );
$$;

create or replace function is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function are_matched(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from matches
    where user_low_id = least(a, b) and user_high_id = greatest(a, b) and is_active
  );
$$;

create or replace function is_conversation_participant(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c join matches m on m.id = c.match_id
    where c.id = cid and auth.uid() in (m.user_low_id, m.user_high_id)
  );
$$;

create or replace function profile_visible_to_me(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or is_admin()
      or exists (
        select 1 from profiles p
        where p.id = target
          and p.is_public and p.onboarding_completed
          and p.status = 'active' and p.deleted_at is null
          and not is_blocked_between(auth.uid(), target)
      );
$$;

-- ---------------------------------------------------------------------------
-- auth.users → profiles / verifications
-- ---------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname, preferred_ui_lang)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'nickname', ''), 20), ''),
    case when new.raw_user_meta_data->>'ui_lang' in ('ja','ko','en')
         then new.raw_user_meta_data->>'ui_lang' else 'ja' end
  );
  insert into verifications (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- 相互いいね → matches / conversations / notifications
-- ---------------------------------------------------------------------------
create or replace function handle_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_low        uuid := least(new.from_user_id, new.to_user_id);
  v_high       uuid := greatest(new.from_user_id, new.to_user_id);
  v_match_id   uuid;
  v_conv_id    uuid;
  v_new_match  boolean := false;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;
  if is_blocked_between(new.from_user_id, new.to_user_id) then
    raise exception 'blocked users cannot like each other' using errcode = '42501';
  end if;

  -- 相手からの active な like があるか
  if not exists (
    select 1 from likes
    where from_user_id = new.to_user_id and to_user_id = new.from_user_id and status = 'active'
  ) then
    insert into notifications (user_id, type, actor_user_id, payload)
    values (new.to_user_id, 'like', new.from_user_id, jsonb_build_object('like_id', new.id));
    return new;
  end if;

  -- Match を取得 or 作成 (非アクティブなら再有効化)
  select id into v_match_id from matches
  where user_low_id = v_low and user_high_id = v_high for update;

  if v_match_id is null then
    insert into matches (user_low_id, user_high_id) values (v_low, v_high) returning id into v_match_id;
    v_new_match := true;
  else
    update matches set is_active = true, matched_at = now(), unmatched_at = null, unmatched_by = null
    where id = v_match_id and not is_active;
    v_new_match := found;
  end if;

  insert into conversations (match_id) values (v_match_id)
  on conflict (match_id) do nothing;
  select id into v_conv_id from conversations where match_id = v_match_id;

  if v_new_match then
    insert into notifications (user_id, type, actor_user_id, payload)
    values
      (new.to_user_id,   'match', new.from_user_id, jsonb_build_object('match_id', v_match_id, 'conversation_id', v_conv_id)),
      (new.from_user_id, 'match', new.to_user_id,   jsonb_build_object('match_id', v_match_id, 'conversation_id', v_conv_id));
  end if;
  return new;
end $$;

create trigger likes_handle_like
  after insert or update of status on likes
  for each row execute function handle_like();

-- ---------------------------------------------------------------------------
-- ブロック → match 無効化・like 取り下げ
-- ---------------------------------------------------------------------------
create or replace function handle_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update matches
     set is_active = false, unmatched_at = now(), unmatched_by = new.blocker_id
   where user_low_id = least(new.blocker_id, new.blocked_id)
     and user_high_id = greatest(new.blocker_id, new.blocked_id)
     and is_active;
  update likes set status = 'withdrawn'
   where status = 'active'
     and ((from_user_id = new.blocker_id and to_user_id = new.blocked_id)
       or (from_user_id = new.blocked_id and to_user_id = new.blocker_id));
  return new;
end $$;

create trigger blocks_handle_block
  after insert on blocks
  for each row execute function handle_block();

-- ---------------------------------------------------------------------------
-- メッセージ → conversation 更新・通知
-- ---------------------------------------------------------------------------
create or replace function after_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_other uuid;
begin
  update conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 100)
   where id = new.conversation_id;

  select case when m.user_low_id = new.sender_id then m.user_high_id else m.user_low_id end
    into v_other
    from conversations c join matches m on m.id = c.match_id
   where c.id = new.conversation_id;

  insert into notifications (user_id, type, actor_user_id, payload)
  values (v_other, 'message', new.sender_id,
          jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id));
  return new;
end $$;

create trigger messages_after_insert
  after insert on messages
  for each row execute function after_message_insert();

-- ---------------------------------------------------------------------------
-- 写真枚数制限
-- ---------------------------------------------------------------------------
create or replace function enforce_photo_limit() returns trigger
language plpgsql as $$
begin
  if (select count(*) from profile_photos where user_id = new.user_id) >= 5 then
    raise exception 'photo limit (5) exceeded' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger profile_photos_limit
  before insert on profile_photos
  for each row execute function enforce_photo_limit();

-- ---------------------------------------------------------------------------
-- 公開プロフィール view (機密列を除外)
-- profiles 本体は column-level GRANT で birthdate 等を authenticated から遮断するため、
-- view は owner 権限で読み、可視条件 profile_visible_to_me() で行を絞る。
-- ---------------------------------------------------------------------------
create or replace view public_profile
with (security_invoker = false) as
select
  p.id,
  p.nickname,
  p.gender,
  extract(year from age(p.birthdate))::int as age,
  p.nationality,
  p.residence_country,
  p.residence_region_id,
  p.occupation,
  p.bio,
  p.meeting_pref,
  p.member_tier = 'paid' as is_paid,
  p.last_active_at,
  p.created_at,
  (v.status = 'verified') as is_verified,
  (select ph.storage_path from profile_photos ph
     where ph.user_id = p.id order by ph.is_primary desc, ph.sort_order limit 1) as primary_photo_path
from profiles p
left join verifications v on v.user_id = p.id
where p.status = 'active' and p.deleted_at is null
  and profile_visible_to_me(p.id);

-- ---------------------------------------------------------------------------
-- RPC: ユーザー向け
-- ---------------------------------------------------------------------------
create or replace function unmatch(p_match_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches%rowtype;
begin
  select * into m from matches where id = p_match_id for update;
  if m.id is null or auth.uid() not in (m.user_low_id, m.user_high_id) then
    raise exception 'match not found' using errcode = 'P0002';
  end if;
  update matches set is_active = false, unmatched_at = now(), unmatched_by = auth.uid()
   where id = p_match_id and is_active;
  update likes set status = 'withdrawn'
   where status = 'active'
     and from_user_id in (m.user_low_id, m.user_high_id)
     and to_user_id   in (m.user_low_id, m.user_high_id);
  insert into user_events (user_id, target_user_id, event_type)
  values (auth.uid(), case when m.user_low_id = auth.uid() then m.user_high_id else m.user_low_id end, 'unmatch');
end $$;

create or replace function mark_conversation_read(p_conversation_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not is_conversation_participant(p_conversation_id) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  update messages set read_at = now()
   where conversation_id = p_conversation_id
     and sender_id <> auth.uid()
     and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function validate_invite_code(p_code text)
returns table (valid boolean, grants_tier member_tier_t)
language sql stable security definer set search_path = public as $$
  select true, grants_tier from invite_codes
  where code = p_code and is_active
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  limit 1;
$$;

create or replace function apply_invite_code(p_code text) returns member_tier_t
language plpgsql security definer set search_path = public as $$
declare
  ic invite_codes%rowtype;
begin
  select * into ic from invite_codes where code = p_code for update;
  if ic.id is null or not ic.is_active
     or (ic.expires_at is not null and ic.expires_at <= now())
     or (ic.max_uses is not null and ic.used_count >= ic.max_uses) then
    raise exception 'invalid invite code' using errcode = '22023';
  end if;
  update profiles set member_tier = ic.grants_tier, invite_code_id = ic.id where id = auth.uid();
  update invite_codes set used_count = used_count + 1 where id = ic.id;
  return ic.grants_tier;
end $$;

create or replace function request_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles
     set status = 'deleted', deleted_at = now(), is_public = false
   where id = auth.uid();
  update matches set is_active = false, unmatched_at = now(), unmatched_by = auth.uid()
   where is_active and auth.uid() in (user_low_id, user_high_id);
  update likes set status = 'withdrawn' where status = 'active' and from_user_id = auth.uid();
end $$;

create or replace function touch_last_active() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- RPC: 検索 / おすすめ (ルールベース)
-- ---------------------------------------------------------------------------
-- 候補となる相手 (自分・ブロック・非公開・停止・退会を除外)
create or replace function candidate_profiles()
returns setof profiles
language sql stable security definer set search_path = public as $$
  select p.* from profiles p
  where p.id <> auth.uid()
    and p.is_public and p.onboarding_completed
    and p.status = 'active' and p.deleted_at is null
    and not is_blocked_between(auth.uid(), p.id);
$$;

create or replace function search_profiles(filters jsonb default '{}'::jsonb, page int default 1, size int default 20)
returns table (id uuid, score int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_size int := greatest(1, least(size, 50));
begin
  return query
  select p.id, 0 as score
  from candidate_profiles() p
  where (filters->>'nationality' is null or p.nationality::text = filters->>'nationality')
    and (filters->>'residence_country' is null or p.residence_country::text = filters->>'residence_country')
    and (filters->>'residence_region_id' is null or p.residence_region_id::text = filters->>'residence_region_id')
    and (filters->>'gender' is null or p.gender::text = filters->>'gender')
    and (filters->>'age_min' is null or extract(year from age(p.birthdate)) >= (filters->>'age_min')::int)
    and (filters->>'age_max' is null or extract(year from age(p.birthdate)) <= (filters->>'age_max')::int)
    and (filters->>'meeting_pref' is null or p.meeting_pref::text = filters->>'meeting_pref')
    and (filters->'purposes' is null or exists (
          select 1 from user_purposes up join purposes pu on pu.id = up.purpose_id
          where up.user_id = p.id and pu.slug in (select jsonb_array_elements_text(filters->'purposes'))))
    and (filters->'interests' is null or exists (
          select 1 from user_interests ui join interests i on i.id = ui.interest_id
          where ui.user_id = p.id and i.slug in (select jsonb_array_elements_text(filters->'interests'))))
    and (filters->>'native_language' is null or exists (
          select 1 from user_languages ul where ul.user_id = p.id and ul.role = 'native'
            and ul.language_code = filters->>'native_language'))
    and (filters->>'learning_language' is null or exists (
          select 1 from user_languages ul where ul.user_id = p.id and ul.role = 'learning'
            and ul.language_code = filters->>'learning_language'
            and (filters->>'learning_level' is null or ul.level::text = filters->>'learning_level')))
    and (coalesce((filters->>'verified_only')::boolean, false) = false or exists (
          select 1 from verifications v where v.user_id = p.id and v.status = 'verified'))
  order by p.last_active_at desc nulls last, p.created_at desc
  limit v_size offset (greatest(page, 1) - 1) * v_size;
end $$;

-- ルールベース推薦: 重みは app_settings.recommend_weights で調整可能
create or replace function recommend_users(p_limit int default 20)
returns table (id uuid, score int, reasons text[])
language plpgsql stable security definer set search_path = public as $$
declare
  me profiles%rowtype;
  w  jsonb;
begin
  select * into me from profiles where profiles.id = auth.uid();
  if me.id is null then
    return;
  end if;
  select value into w from app_settings where key = 'recommend_weights';
  w := coalesce(w, '{}'::jsonb);

  return query
  with cand as (
    select p.* from candidate_profiles() p
    where not exists (select 1 from likes l where l.from_user_id = me.id and l.to_user_id = p.id and l.status = 'active')
      and not are_matched(me.id, p.id)
  ),
  scored as (
    select
      c.id,
      -- 希望性別
      case when me.pref_gender is null or c.gender = any(me.pref_gender)
           then coalesce((w->>'gender')::int, 30) else 0 end as s_gender,
      -- 相手の希望性別に自分が合う
      case when c.pref_gender is null or me.gender = any(c.pref_gender)
           then coalesce((w->>'gender_mutual')::int, 20) else 0 end as s_gender_mutual,
      -- 国籍 (希望国籍 / 日韓ペア)
      case when me.pref_nationality is not null and c.nationality = any(me.pref_nationality)
             then coalesce((w->>'nationality')::int, 25)
           when me.pref_nationality is null and me.nationality is distinct from c.nationality
             and me.nationality in ('JP','KR') and c.nationality in ('JP','KR')
             then coalesce((w->>'nationality')::int, 25)
           else 0 end as s_nationality,
      -- 年齢が希望範囲内
      case when extract(year from age(c.birthdate)) between coalesce(me.pref_age_min, 18) and coalesce(me.pref_age_max, 99)
           then coalesce((w->>'age')::int, 15) else 0 end as s_age,
      -- 言語補完 (自分の学習言語 = 相手の母語 / 相手の学習言語 = 自分の母語)
      (select count(*) from user_languages a join user_languages b
          on a.language_code = b.language_code
       where a.user_id = me.id and b.user_id = c.id
         and ((a.role = 'learning' and b.role = 'native') or (a.role = 'native' and b.role = 'learning')))::int
        * coalesce((w->>'language')::int, 20) as s_language,
      -- 共通の趣味
      least((select count(*) from user_interests a join user_interests b on a.interest_id = b.interest_id
             where a.user_id = me.id and b.user_id = c.id), 5)::int
        * coalesce((w->>'interest')::int, 5) as s_interest,
      -- 共通の利用目的
      least((select count(*) from user_purposes a join user_purposes b on a.purpose_id = b.purpose_id
             where a.user_id = me.id and b.user_id = c.id), 3)::int
        * coalesce((w->>'purpose')::int, 10) as s_purpose,
      -- 居住地
      case when me.residence_region_id is not null and me.residence_region_id = c.residence_region_id
             then coalesce((w->>'region')::int, 10)
           when me.residence_country = c.residence_country then coalesce((w->>'country')::int, 5)
           else 0 end as s_region,
      -- 交流希望が一致
      case when me.meeting_pref is not null and me.meeting_pref = c.meeting_pref
           then coalesce((w->>'meeting_pref')::int, 5) else 0 end as s_meeting,
      -- 最近アクティブ
      case when c.last_active_at > now() - interval '7 days' then coalesce((w->>'recent')::int, 5) else 0 end as s_recent,
      -- 本人確認済み
      case when exists (select 1 from verifications v where v.user_id = c.id and v.status = 'verified')
           then coalesce((w->>'verified')::int, 5) else 0 end as s_verified
    from cand c
  )
  select
    s.id,
    (s.s_gender + s.s_gender_mutual + s.s_nationality + s.s_age + s.s_language
     + s.s_interest + s.s_purpose + s.s_region + s.s_meeting + s.s_recent + s.s_verified) as score,
    array_remove(array[
      case when s.s_language   > 0 then 'language_exchange' end,
      case when s.s_interest   > 0 then 'shared_interests' end,
      case when s.s_purpose    > 0 then 'shared_purpose' end,
      case when s.s_region     > 0 then 'nearby' end,
      case when s.s_nationality> 0 then 'nationality' end,
      case when s.s_verified   > 0 then 'verified' end
    ], null) as reasons
  from scored s
  order by score desc, random()
  limit greatest(1, least(p_limit, 50));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: 管理者
-- ---------------------------------------------------------------------------
create or replace function admin_log(p_action text, p_target_type text, p_target_id text, p_metadata jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
$$;

create or replace function admin_set_status(p_user_id uuid, p_status account_status_t, p_reason text default null, p_until timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update profiles
     set status = p_status,
         status_reason = p_reason,
         suspended_until = case when p_status = 'suspended' then p_until else null end,
         is_public = case when p_status = 'active' then is_public else false end
   where id = p_user_id;
  if p_status in ('banned','deleted') then
    update matches set is_active = false, unmatched_at = now()
     where is_active and p_user_id in (user_low_id, user_high_id);
  end if;
  perform admin_log('set_status', 'user', p_user_id::text,
                    jsonb_build_object('status', p_status, 'reason', p_reason, 'until', p_until));
end $$;

create or replace function admin_resolve_report(p_report_id uuid, p_status report_status_t, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update reports
     set status = p_status, admin_note = p_note, handled_by = auth.uid(),
         resolved_at = case when p_status in ('resolved','dismissed') then now() else resolved_at end
   where id = p_report_id;
  perform admin_log('resolve_report', 'report', p_report_id::text,
                    jsonb_build_object('status', p_status, 'note', p_note));
end $$;

create or replace function admin_set_verification(p_user_id uuid, p_status verification_status_t, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update verifications
     set status = p_status,
         verified_at = case when p_status = 'verified' then now() else null end,
         rejected_reason = case when p_status = 'rejected' then p_reason else null end
   where user_id = p_user_id;
  insert into notifications (user_id, type, payload)
  values (p_user_id, 'verification', jsonb_build_object('status', p_status));
  perform admin_log('set_verification', 'user', p_user_id::text, jsonb_build_object('status', p_status));
end $$;

-- ---------------------------------------------------------------------------
-- 権限: RPC は authenticated のみ実行可
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function is_admin(), admin_role(), is_active_member(),
  is_blocked_between(uuid, uuid), are_matched(uuid, uuid), is_conversation_participant(uuid),
  profile_visible_to_me(uuid), unmatch(uuid), mark_conversation_read(uuid),
  validate_invite_code(text), apply_invite_code(text), request_account_deletion(), touch_last_active(),
  search_profiles(jsonb, int, int), recommend_users(int),
  admin_set_status(uuid, account_status_t, text, timestamptz),
  admin_resolve_report(uuid, report_status_t, text),
  admin_set_verification(uuid, verification_status_t, text)
  to authenticated;
grant select on public_profile to authenticated;
