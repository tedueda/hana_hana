-- 管理画面用 RPC (security definer / is_admin() ガード)

create or replace function admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total',        (select count(*) from profiles where deleted_at is null),
    'users_active',       (select count(*) from profiles where status = 'active' and deleted_at is null),
    'users_suspended',    (select count(*) from profiles where status = 'suspended'),
    'users_banned',       (select count(*) from profiles where status = 'banned'),
    'users_jp',           (select count(*) from profiles where nationality = 'JP' and deleted_at is null),
    'users_kr',           (select count(*) from profiles where nationality = 'KR' and deleted_at is null),
    'users_paid',         (select count(*) from profiles where member_tier = 'paid' and deleted_at is null),
    'users_new_7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active_24h',         (select count(*) from profiles where last_active_at > now() - interval '24 hours'),
    'likes_total',        (select count(*) from likes where status = 'active'),
    'matches_active',     (select count(*) from matches where is_active),
    'matches_total',      (select count(*) from matches),
    'messages_total',     (select count(*) from messages),
    'messages_24h',       (select count(*) from messages where created_at > now() - interval '24 hours'),
    'reports_open',       (select count(*) from reports where status in ('open','in_review')),
    'verifications_pending', (select count(*) from verifications where status = 'pending')
  );
end $$;

-- 会員一覧 (email は auth.users から取得)
create or replace function admin_list_users(
  p_query text default null,
  p_status account_status_t default null,
  p_nationality nationality_t default null,
  p_verification verification_status_t default null,
  p_page int default 1,
  p_size int default 30
) returns table (
  id uuid, email text, nickname text, gender gender_t, birthdate date, nationality nationality_t,
  residence_country country_t, member_tier member_tier_t, status account_status_t,
  suspended_until timestamptz, status_reason text, onboarding_completed boolean, is_public boolean,
  verification_status verification_status_t, last_active_at timestamptz, created_at timestamptz,
  report_count bigint, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  with base as (
    select p.*, u.email as u_email, v.status as v_status,
           (select count(*) from reports r where r.reported_user_id = p.id) as rc
    from profiles p
    join auth.users u on u.id = p.id
    left join verifications v on v.user_id = p.id
    where (p_status is null or p.status = p_status)
      and (p_nationality is null or p.nationality = p_nationality)
      and (p_verification is null or v.status = p_verification)
      and (p_query is null or p_query = ''
           or p.nickname ilike '%' || p_query || '%'
           or u.email ilike '%' || p_query || '%'
           or p.id::text = p_query)
  )
  select b.id, b.u_email::text, b.nickname, b.gender, b.birthdate, b.nationality, b.residence_country,
         b.member_tier, b.status, b.suspended_until, b.status_reason, b.onboarding_completed, b.is_public,
         b.v_status, b.last_active_at, b.created_at, b.rc, count(*) over ()
  from base b
  order by b.created_at desc
  limit greatest(p_size, 1) offset greatest(p_page - 1, 0) * greatest(p_size, 1);
end $$;

-- 会員詳細 (プロフィール全列 + email + 集計)
create or replace function admin_get_user(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'email', u.email,
    'email_confirmed_at', u.email_confirmed_at,
    'last_sign_in_at', u.last_sign_in_at,
    'verification', to_jsonb(ver),
    'languages', (select coalesce(jsonb_agg(to_jsonb(ul)), '[]') from user_languages ul where ul.user_id = p.id),
    'purposes', (select coalesce(jsonb_agg(pu.slug), '[]') from user_purposes up join purposes pu on pu.id = up.purpose_id where up.user_id = p.id),
    'interests', (select coalesce(jsonb_agg(i.slug), '[]') from user_interests ui join interests i on i.id = ui.interest_id where ui.user_id = p.id),
    'photos', (select coalesce(jsonb_agg(to_jsonb(ph) order by ph.sort_order), '[]') from profile_photos ph where ph.user_id = p.id),
    'stats', jsonb_build_object(
      'likes_sent', (select count(*) from likes where from_user_id = p.id and status = 'active'),
      'likes_received', (select count(*) from likes where to_user_id = p.id and status = 'active'),
      'matches', (select count(*) from matches where is_active and p.id in (user_low_id, user_high_id)),
      'messages_sent', (select count(*) from messages where sender_id = p.id),
      'reports_received', (select count(*) from reports where reported_user_id = p.id),
      'reports_made', (select count(*) from reports where reporter_id = p.id),
      'blocked_by_count', (select count(*) from blocks where blocked_id = p.id)
    ),
    'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]')
              from (select * from admin_audit_logs where target_type = 'user' and target_id = p.id::text order by created_at desc limit 20) a)
  ) into v
  from profiles p
  join auth.users u on u.id = p.id
  left join verifications ver on ver.user_id = p.id
  where p.id = p_user_id;
  return v;
end $$;

-- 通報一覧 (通報者/被通報者のニックネーム・対象メッセージ本文付き)
create or replace function admin_list_reports(p_status report_status_t default null, p_page int default 1, p_size int default 30)
returns table (
  id uuid, reporter_id uuid, reporter_nickname text, reported_user_id uuid, reported_nickname text,
  reported_status account_status_t, reason report_reason_t, detail text, message_id uuid, message_body text,
  status report_status_t, handled_by uuid, admin_note text, resolved_at timestamptz, created_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select r.id, r.reporter_id, rp.nickname, r.reported_user_id, tp.nickname, tp.status,
         r.reason, r.detail, r.message_id, m.body, r.status, r.handled_by, r.admin_note, r.resolved_at, r.created_at,
         count(*) over ()
  from reports r
  left join profiles rp on rp.id = r.reporter_id
  left join profiles tp on tp.id = r.reported_user_id
  left join messages m on m.id = r.message_id
  where p_status is null or r.status = p_status
  order by (r.status in ('open','in_review')) desc, r.created_at desc
  limit greatest(p_size, 1) offset greatest(p_page - 1, 0) * greatest(p_size, 1);
end $$;

-- 管理者の追加/削除 (super_admin のみ)
create or replace function admin_upsert_admin(p_email text, p_role admin_role_t) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if admin_role() <> 'super_admin' then raise exception 'super_admin only' using errcode = '42501'; end if;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then raise exception 'user not found: %', p_email; end if;
  insert into admin_users (user_id, role, created_by) values (uid, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;
  perform admin_log('upsert_admin', 'admin', uid::text, jsonb_build_object('role', p_role, 'email', p_email));
  return uid;
end $$;

create or replace function admin_remove_admin(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if admin_role() <> 'super_admin' then raise exception 'super_admin only' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot remove yourself'; end if;
  delete from admin_users where user_id = p_user_id;
  perform admin_log('remove_admin', 'admin', p_user_id::text, null);
end $$;

-- 管理者一覧 (email 付き)
create or replace function admin_list_admins()
returns table (user_id uuid, email text, nickname text, role admin_role_t, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select a.user_id, u.email::text, p.nickname, a.role, a.created_at
  from admin_users a join auth.users u on u.id = a.user_id left join profiles p on p.id = a.user_id
  order by a.created_at;
end $$;

grant execute on function
  admin_stats(),
  admin_list_users(text, account_status_t, nationality_t, verification_status_t, int, int),
  admin_get_user(uuid),
  admin_list_reports(report_status_t, int, int),
  admin_upsert_admin(text, admin_role_t),
  admin_remove_admin(uuid),
  admin_list_admins()
  to authenticated;
