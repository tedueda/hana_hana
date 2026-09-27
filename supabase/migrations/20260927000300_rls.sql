-- Row Level Security
-- 設計書: docs/hanahana/05_rls_design.md

alter table admin_users          enable row level security;
alter table admin_audit_logs     enable row level security;
alter table languages            enable row level security;
alter table interests            enable row level security;
alter table purposes             enable row level security;
alter table regions              enable row level security;
alter table plans                enable row level security;
alter table app_settings         enable row level security;
alter table invite_codes         enable row level security;
alter table profiles             enable row level security;
alter table profile_photos       enable row level security;
alter table user_languages       enable row level security;
alter table user_interests       enable row level security;
alter table user_purposes        enable row level security;
alter table likes                enable row level security;
alter table matches              enable row level security;
alter table conversations        enable row level security;
alter table messages             enable row level security;
alter table message_translations enable row level security;
alter table user_events          enable row level security;
alter table blocks               enable row level security;
alter table reports              enable row level security;
alter table verifications        enable row level security;
alter table notifications        enable row level security;
alter table announcements        enable row level security;
alter table subscriptions        enable row level security;
alter table payments             enable row level security;

-- ---------------------------------------------------------------------------
-- 管理
-- ---------------------------------------------------------------------------
create policy admin_users_select on admin_users for select to authenticated using (is_admin());
create policy admin_users_write  on admin_users for all    to authenticated
  using (admin_role() = 'super_admin') with check (admin_role() = 'super_admin');

create policy admin_audit_logs_select on admin_audit_logs for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- マスター: 認証済みは is_active のみ閲覧、admin は全操作
-- ---------------------------------------------------------------------------
create policy languages_select on languages for select to authenticated using (is_active or is_admin());
create policy languages_admin  on languages for all    to authenticated using (is_admin()) with check (is_admin());

create policy interests_select on interests for select to authenticated using (is_active or is_admin());
create policy interests_admin  on interests for all    to authenticated using (is_admin()) with check (is_admin());

create policy purposes_select on purposes for select to authenticated using (is_active or is_admin());
create policy purposes_admin  on purposes for all    to authenticated using (is_admin()) with check (is_admin());

create policy regions_select on regions for select to authenticated using (is_active or is_admin());
create policy regions_admin  on regions for all    to authenticated using (is_admin()) with check (is_admin());

create policy plans_select on plans for select to authenticated using (is_active or is_admin());
create policy plans_admin  on plans for all    to authenticated using (is_admin()) with check (is_admin());

create policy app_settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy invite_codes_admin on invite_codes for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select to authenticated
  using (profile_visible_to_me(id));

create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_update on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

-- 機密列は本人でも直接更新不可 (RPC / admin のみ)
revoke update on profiles from authenticated;
grant update (
  nickname, gender, birthdate, nationality, residence_country, residence_region_id,
  occupation, bio, meeting_pref, pref_gender, pref_age_min, pref_age_max, pref_nationality,
  is_public, onboarding_completed, preferred_ui_lang, last_active_at
) on profiles to authenticated;

-- 他人に見せない列は public_profile view 経由で読む想定。直接 SELECT では本人/admin 以外に
-- 見せたくない列を column-level で遮断する。
revoke select on profiles from authenticated;
grant select (
  id, nickname, gender, nationality, residence_country, residence_region_id, occupation, bio,
  meeting_pref, is_public, onboarding_completed, member_tier, status, preferred_ui_lang,
  last_active_at, created_at, updated_at
) on profiles to authenticated;
-- 本人専用列 (birthdate, pref_*, suspended_until, status_reason, invite_code_id, deleted_at)
-- は RPC my_profile() で取得する
create or replace function my_profile() returns setof profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;
grant execute on function my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- profile 付随テーブル
-- ---------------------------------------------------------------------------
create policy profile_photos_select on profile_photos for select to authenticated
  using (profile_visible_to_me(user_id));
create policy profile_photos_write on profile_photos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_photos_admin_delete on profile_photos for delete to authenticated
  using (is_admin());

create policy user_languages_select on user_languages for select to authenticated
  using (profile_visible_to_me(user_id));
create policy user_languages_write on user_languages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_interests_select on user_interests for select to authenticated
  using (profile_visible_to_me(user_id));
create policy user_interests_write on user_interests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_purposes_select on user_purposes for select to authenticated
  using (profile_visible_to_me(user_id));
create policy user_purposes_write on user_purposes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
create policy likes_select on likes for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid() or is_admin());

create policy likes_insert on likes for insert to authenticated
  with check (
    from_user_id = auth.uid()
    and from_user_id <> to_user_id
    and is_active_member()
    and not is_blocked_between(from_user_id, to_user_id)
    and profile_visible_to_me(to_user_id)
  );

create policy likes_update_own on likes for update to authenticated
  using (from_user_id = auth.uid() and is_active_member())
  with check (from_user_id = auth.uid());
revoke update on likes from authenticated;
grant update (status) on likes to authenticated;

-- ---------------------------------------------------------------------------
-- matches / conversations / messages
-- ---------------------------------------------------------------------------
create policy matches_select on matches for select to authenticated
  using (auth.uid() in (user_low_id, user_high_id) or is_admin());
-- INSERT/UPDATE はトリガー・RPC (security definer) のみ

create policy conversations_select on conversations for select to authenticated
  using (is_conversation_participant(id) or is_admin());

create policy messages_select on messages for select to authenticated
  using (is_conversation_participant(conversation_id) or is_admin());

create policy messages_insert on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_active_member()
    and exists (
      select 1 from conversations c join matches m on m.id = c.match_id
      where c.id = conversation_id
        and m.is_active
        and auth.uid() in (m.user_low_id, m.user_high_id)
        and not is_blocked_between(m.user_low_id, m.user_high_id)
    )
  );

-- 送信者本人の論理削除のみ
create policy messages_update_own on messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
revoke update on messages from authenticated;
grant update (deleted_at) on messages to authenticated;

create policy message_translations_select on message_translations for select to authenticated
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_participant(m.conversation_id)));

-- ---------------------------------------------------------------------------
-- user_events
-- ---------------------------------------------------------------------------
create policy user_events_select on user_events for select to authenticated using (is_admin());
create policy user_events_insert on user_events for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- blocks / reports / verifications
-- ---------------------------------------------------------------------------
create policy blocks_select on blocks for select to authenticated
  using (blocker_id = auth.uid() or is_admin());
create policy blocks_insert on blocks for insert to authenticated
  with check (blocker_id = auth.uid() and blocker_id <> blocked_id);
create policy blocks_delete on blocks for delete to authenticated
  using (blocker_id = auth.uid());

create policy reports_select on reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin());
create policy reports_insert on reports for insert to authenticated
  with check (reporter_id = auth.uid() and reporter_id <> reported_user_id and is_active_member());
-- UPDATE は admin_resolve_report RPC のみ

create policy verifications_select on verifications for select to authenticated
  using (user_id = auth.uid() or is_admin());
-- 書き込みは Edge Function (service_role) / admin RPC のみ

-- ---------------------------------------------------------------------------
-- notifications / announcements
-- ---------------------------------------------------------------------------
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on notifications for delete to authenticated using (user_id = auth.uid());
revoke update on notifications from authenticated;
grant update (is_read) on notifications to authenticated;

create policy announcements_select on announcements for select to authenticated
  using (is_admin() or (published_at is not null and published_at <= now() and (expires_at is null or expires_at > now())));
create policy announcements_admin on announcements for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- subscriptions / payments: 本人 or admin の閲覧のみ (書き込みは service_role)
-- ---------------------------------------------------------------------------
create policy subscriptions_select on subscriptions for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy payments_select on payments for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- anon には一切のテーブル権限を与えない
revoke all on all tables in schema public from anon;
