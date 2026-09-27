-- RLS / トリガーのスモークテスト (docs/hanahana/05_rls_design.md §4 R01-R18 の主要項目)
-- 単一トランザクションで実行し、最後に rollback するため DB にデータは残らない。
-- 実行: supabase/scripts/run_sql.sh supabase/tests/rls_smoke_test.sql
begin;

create temp table t_results (name text, ok boolean, detail text) on commit drop;
grant all on t_results to authenticated;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into t_results values (p_name, p_ok, p_detail); $$;

create or replace function pg_temp.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_super() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  adm uuid := gen_random_uuid();
  v_match uuid;
  v_conv uuid;
  n int;
  ok boolean;
begin
  -- ---------- セットアップ (postgres) ----------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
  values
    (a,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local', '', '{"nickname":"A"}', now(), now()),
    (b,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local', '', '{"nickname":"B"}', now(), now()),
    (c,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.local', '', '{"nickname":"C"}', now(), now()),
    (adm, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.local', '', '{"nickname":"Admin"}', now(), now());

  perform pg_temp.check('T00 handle_new_user creates profiles+verifications',
    (select count(*) from profiles where id in (a,b,c,adm)) = 4
    and (select count(*) from verifications where user_id in (a,b,c,adm)) = 4);

  update profiles set onboarding_completed = true, birthdate = '1995-01-01', gender = 'male',
         nationality = 'JP', residence_country = 'JP'
   where id in (a, c);
  update profiles set onboarding_completed = true, birthdate = '1996-01-01', gender = 'female',
         nationality = 'KR', residence_country = 'KR', pref_gender = array['male']::gender_t[]
   where id = b;
  update profiles set onboarding_completed = true where id = adm;
  insert into admin_users (user_id, role) values (adm, 'super_admin');
  insert into user_languages values (a, 'ja', 'native', 'native'), (a, 'ko', 'learning', 'beginner'),
                                    (b, 'ko', 'native', 'native'), (b, 'ja', 'learning', 'intermediate');

  -- ---------- R01: A が B の public_profile を見られる / birthdate は列としてない ----------
  perform pg_temp.as_user(a);
  perform pg_temp.check('R01 A sees B via public_profile',
    (select count(*) from public_profile where id = b) = 1);
  perform pg_temp.check('R01b public_profile exposes age not birthdate',
    (select count(*) from information_schema.columns where table_name='public_profile' and column_name='birthdate') = 0
    and (select age from public_profile where id = b) between 28 and 32);

  -- A が profiles.birthdate を直接 SELECT → permission denied
  begin
    perform (select birthdate from profiles where id = b);
    perform pg_temp.check('R01c direct select of birthdate denied', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R01c direct select of birthdate denied', true);
  end;

  -- ---------- R02: 非公開ユーザーは見えない ----------
  perform pg_temp.as_super();
  update profiles set is_public = false where id = c;
  perform pg_temp.as_user(a);
  perform pg_temp.check('R02 private profile hidden', (select count(*) from public_profile where id = c) = 0);
  perform pg_temp.as_super();
  update profiles set is_public = true where id = c;

  -- ---------- R04: 他人の profiles UPDATE は 0 行 ----------
  perform pg_temp.as_user(a);
  update profiles set bio = 'hacked' where id = b;
  get diagnostics n = row_count;
  perform pg_temp.check('R04 cannot update others profile', n = 0);

  -- ---------- R05: 自分の member_tier UPDATE は permission denied ----------
  begin
    update profiles set member_tier = 'paid' where id = a;
    perform pg_temp.check('R05 cannot self-upgrade member_tier', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R05 cannot self-upgrade member_tier', true);
  end;

  -- ---------- R06: from_user_id を偽装した like は違反 ----------
  begin
    insert into likes (from_user_id, to_user_id) values (b, a);
    perform pg_temp.check('R06 cannot insert like as someone else', false);
  exception when insufficient_privilege or check_violation then
    perform pg_temp.check('R06 cannot insert like as someone else', true);
  end;

  -- ---------- R07: 相互いいね → match + conversation + 通知 ----------
  insert into likes (from_user_id, to_user_id) values (a, b);
  perform pg_temp.check('R07a one-sided like: no match', (select count(*) from matches) = 0);
  perform pg_temp.as_super();
  perform pg_temp.check('R07b like notification to B',
    (select count(*) from notifications where user_id = b and type = 'like') = 1);

  perform pg_temp.as_user(b);
  insert into likes (from_user_id, to_user_id) values (b, a);
  select id into v_match from matches where user_low_id = least(a,b) and user_high_id = greatest(a,b) and is_active;
  perform pg_temp.check('R07c mutual like creates active match', v_match is not null);
  select id into v_conv from conversations where match_id = v_match;
  perform pg_temp.check('R07d conversation created', v_conv is not null);
  perform pg_temp.as_super();
  perform pg_temp.check('R07e match notifications to both',
    (select count(*) from notifications where type = 'match' and user_id in (a,b)) = 2);

  -- 冪等性: B が like を withdrawn→active にしても重複しない
  perform pg_temp.as_user(b);
  update likes set status = 'withdrawn' where from_user_id = b and to_user_id = a;
  update likes set status = 'active' where from_user_id = b and to_user_id = a;
  perform pg_temp.check('R07f re-like does not duplicate match/conversation',
    (select count(*) from matches) = 1 and (select count(*) from conversations) = 1);
  perform pg_temp.as_super();
  perform pg_temp.check('R07g re-like does not duplicate match notifications',
    (select count(*) from notifications where type = 'match' and user_id in (a, b)) = 2);

  -- ---------- メッセージ ----------
  perform pg_temp.as_user(a);
  insert into messages (conversation_id, sender_id, body) values (v_conv, a, 'こんにちは');
  perform pg_temp.check('M01 participant can send message', (select count(*) from messages where conversation_id = v_conv) = 1);
  perform pg_temp.as_super();
  perform pg_temp.check('M02 message notification + conversation preview',
    (select count(*) from notifications where user_id = b and type = 'message') = 1
    and (select last_message_preview from conversations where id = v_conv) = 'こんにちは');

  -- R08: 第三者 C は messages を読めない
  perform pg_temp.as_user(c);
  perform pg_temp.check('R08 third party cannot read messages', (select count(*) from messages) = 0);
  perform pg_temp.check('R08b third party cannot see match', (select count(*) from matches) = 0);

  -- R09: マッチしていない C が送信 → 違反
  begin
    insert into messages (conversation_id, sender_id, body) values (v_conv, c, 'spam');
    perform pg_temp.check('R09 non-participant cannot send', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R09 non-participant cannot send', true);
  end;

  -- 既読
  perform pg_temp.as_user(b);
  perform pg_temp.check('M03 mark_conversation_read', mark_conversation_read(v_conv) = 1);

  -- ---------- R11-R14: 他人の機密データ ----------
  perform pg_temp.as_user(a);
  perform pg_temp.check('R11 cannot read others verifications', (select count(*) from verifications where user_id = b) = 0);
  perform pg_temp.check('R14 cannot read others subscriptions', (select count(*) from subscriptions where user_id = b) = 0);
  perform pg_temp.as_super();
  insert into reports (reporter_id, reported_user_id, reason) values (c, a, 'harassment');
  perform pg_temp.as_user(a);
  perform pg_temp.check('R12 cannot read others reports', (select count(*) from reports) = 0);

  -- ---------- R17: おすすめ ----------
  perform pg_temp.as_user(c);
  perform pg_temp.check('R17 recommend_users excludes self, includes A/B',
    (select count(*) from recommend_users(10) r where r.id = c) = 0
    and (select count(*) from recommend_users(10) r where r.id in (a, b)) = 2);
  perform pg_temp.as_user(a);
  perform pg_temp.check('R17b recommend_users excludes already-matched B',
    (select count(*) from recommend_users(10) r where r.id = b) = 0);

  -- ---------- R10/R13: ブロック ----------
  perform pg_temp.as_user(b);
  insert into blocks (blocker_id, blocked_id) values (b, a);
  perform pg_temp.as_super();
  perform pg_temp.check('R10a block deactivates match + withdraws likes',
    (select is_active from matches where id = v_match) = false
    and (select count(*) from likes where status = 'active' and from_user_id in (a,b) and to_user_id in (a,b)) = 0);
  perform pg_temp.as_user(a);
  perform pg_temp.check('R13 blocked user cannot see block row', (select count(*) from blocks) = 0);
  perform pg_temp.check('R03 blocked user cannot see blocker profile', (select count(*) from public_profile where id = b) = 0);
  begin
    insert into messages (conversation_id, sender_id, body) values (v_conv, a, 'after block');
    perform pg_temp.check('R10b blocked user cannot send message', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R10b blocked user cannot send message', true);
  end;
  begin
    insert into likes (from_user_id, to_user_id) values (a, b);
    perform pg_temp.check('R10c blocked user cannot like', false);
  exception when insufficient_privilege or unique_violation then
    perform pg_temp.check('R10c blocked user cannot like', true);
  end;

  -- ---------- R18: 停止中ユーザー ----------
  perform pg_temp.as_super();
  perform pg_temp.as_user(adm);
  perform admin_set_status(c, 'suspended', 'test', now() + interval '1 day');
  perform pg_temp.as_user(c);
  begin
    insert into likes (from_user_id, to_user_id) values (c, a);
    perform pg_temp.check('R18 suspended user cannot like', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R18 suspended user cannot like', true);
  end;
  perform pg_temp.as_super();
  perform pg_temp.check('R18b suspend hides profile', (select is_public from profiles where id = c) = false);
  perform pg_temp.as_user(adm);
  perform admin_set_status(c, 'active');
  perform pg_temp.as_super();
  perform pg_temp.check('R18c restore to active makes profile public again',
    (select is_public and suspended_until is null from profiles where id = c));

  -- ---------- R15: admin ----------
  perform pg_temp.as_user(adm);
  perform pg_temp.check('R15 admin reads all reports', (select count(*) from reports where reporter_id = c) = 1);
  perform admin_resolve_report((select id from reports where reporter_id = c), 'resolved', 'ok');
  perform pg_temp.check('R15b admin_resolve_report + audit log',
    (select status from reports where reporter_id = c) = 'resolved'
    and (select count(*) from admin_audit_logs where admin_user_id = adm and action in ('set_status','resolve_report')) = 3);

  -- 非 admin が admin RPC を呼ぶ
  perform pg_temp.as_user(a);
  begin
    perform admin_set_status(b, 'banned');
    perform pg_temp.check('R15c non-admin cannot call admin RPC', false);
  exception when insufficient_privilege then
    perform pg_temp.check('R15c non-admin cannot call admin RPC', true);
  end;

  -- ---------- A01-A14: STEP7 admin RPC ----------
  perform pg_temp.as_user(adm);
  perform pg_temp.check('A01 admin_stats returns counts',
    (admin_stats()->>'users_total')::int >= 4 and (admin_stats()->>'users_jp')::int >= 2);
  perform pg_temp.check('A02 admin_list_users search by email',
    (select count(*) from admin_list_users(p_query => 'b@test.local')) = 1
    and (select email from admin_list_users(p_query => 'b@test.local')) = 'b@test.local');
  perform pg_temp.check('A03 admin_list_users filter by status',
    (select count(*) from admin_list_users(p_query => 'c@test.local', p_status => 'active')) = 1
    and (select count(*) from admin_list_users(p_query => 'c@test.local', p_status => 'suspended')) = 0);
  perform pg_temp.check('A04 admin_get_user returns email/stats/audit',
    (admin_get_user(b)->>'email') = 'b@test.local'
    and (admin_get_user(b)->'stats') is not null);
  perform pg_temp.check('A05 admin_list_reports joins nicknames',
    (select count(*) from admin_list_reports(p_size => 1000) where reporter_id = c) = 1
    and (select reported_nickname from admin_list_reports(p_size => 1000) where reporter_id = c) is not null);
  perform pg_temp.check('A06 admin_list_admins',
    (select count(*) from admin_list_admins() where user_id = adm and role = 'super_admin') = 1);
  perform admin_upsert_admin('c@test.local', 'moderator');
  perform pg_temp.check('A07 admin_upsert_admin adds moderator + audit',
    (select role from admin_users where user_id = c) = 'moderator'
    and (select count(*) from admin_audit_logs where admin_user_id = adm and action = 'upsert_admin') = 1);

  -- moderator は管理者追加不可
  perform pg_temp.as_user(c);
  begin
    perform admin_upsert_admin('a@test.local', 'support');
    perform pg_temp.check('A08 moderator cannot upsert admin', false);
  exception when insufficient_privilege then
    perform pg_temp.check('A08 moderator cannot upsert admin', true);
  end;
  perform pg_temp.check('A09 moderator can call admin_stats', (admin_stats()->>'users_total')::int >= 4);

  -- 非 admin は list/stats/get 不可
  perform pg_temp.as_user(a);
  begin
    perform admin_stats();
    perform pg_temp.check('A10 non-admin cannot call admin_stats', false);
  exception when insufficient_privilege then
    perform pg_temp.check('A10 non-admin cannot call admin_stats', true);
  end;
  begin
    perform count(*) from admin_list_users();
    perform pg_temp.check('A11 non-admin cannot call admin_list_users', false);
  exception when insufficient_privilege then
    perform pg_temp.check('A11 non-admin cannot call admin_list_users', true);
  end;
  begin
    perform admin_get_user(b);
    perform pg_temp.check('A12 non-admin cannot call admin_get_user', false);
  exception when insufficient_privilege then
    perform pg_temp.check('A12 non-admin cannot call admin_get_user', true);
  end;

  perform pg_temp.as_user(adm);
  perform admin_remove_admin(c);
  perform pg_temp.check('A13 admin_remove_admin', (select count(*) from admin_users where user_id = c) = 0);
  begin
    perform admin_remove_admin(adm);
    perform pg_temp.check('A14 cannot remove self', false);
  exception when others then
    perform pg_temp.check('A14 cannot remove self', true);
  end;

  perform pg_temp.as_super();
end $$;

select name, case when ok then 'PASS' else 'FAIL' end as result from t_results
union all
select 'TOTAL', format('%s passed, %s failed', count(*) filter (where ok), count(*) filter (where not ok)) from t_results
order by 1;

rollback;
