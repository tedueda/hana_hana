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
  v_post uuid;
  v_post2 uuid;
  v_comment uuid;
  v_report uuid;
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
  -- 写真必須 (photo_required) のため、公開対象ユーザーには主写真を 1 枚ずつ登録
  insert into profile_photos (user_id, storage_path, sort_order, is_primary)
  values (a, a || '/p0.jpg', 0, true), (b, b || '/p0.jpg', 0, true), (c, c || '/p0.jpg', 0, true);

  -- ---------- V01-V04: 生年月日の検証 / 写真必須 (UI/UX A-2) ----------
  begin
    update profiles set birthdate = current_date + 1 where id = a;
    perform pg_temp.check('V01 future birthdate rejected', false);
  exception when check_violation then
    perform pg_temp.check('V01 future birthdate rejected', true);
  end;
  begin
    update profiles set birthdate = current_date - interval '17 years' where id = a;
    perform pg_temp.check('V02 underage birthdate rejected (min_age)', false);
  exception when check_violation then
    perform pg_temp.check('V02 underage birthdate rejected (min_age)', true);
  end;
  perform pg_temp.check('V02b birthdate unchanged after rejections',
    (select birthdate from profiles where id = a) = '1995-01-01');

  perform pg_temp.as_user(a);
  perform pg_temp.check('V03 my_publish_status publishable with photo',
    (my_publish_status() ->> 'publishable')::bool and (my_publish_status() ->> 'photo_count')::int = 1);
  perform pg_temp.as_super();
  delete from profile_photos where user_id = c;
  perform pg_temp.as_user(a);
  perform pg_temp.check('V04 new user without photo hidden from public_profile',
    (select count(*) from public_profile where id = c) = 0);
  perform pg_temp.check('V04b new user without photo excluded from candidate_profiles',
    (select count(*) from candidate_profiles() where id = c) = 0);
  perform pg_temp.as_user(c);
  perform pg_temp.check('V04c my_publish_status not publishable / not in grace for new user',
    not (my_publish_status() ->> 'publishable')::bool and not (my_publish_status() ->> 'in_grace')::bool);
  perform pg_temp.as_super();
  -- 既存アカウント (猶予開始日より前に作成) は猶予期間中は写真なしでも公開
  update profiles set created_at = now() - interval '30 days' where id = c;
  update app_settings set value = to_jsonb((current_date + 7)::text) where key = 'photo_grace_until';
  perform pg_temp.as_user(a);
  perform pg_temp.check('V04d existing user without photo visible during grace',
    (select count(*) from public_profile where id = c) = 1);
  perform pg_temp.as_super();
  update app_settings set value = to_jsonb((current_date - 1)::text) where key = 'photo_grace_until';
  perform pg_temp.as_user(a);
  perform pg_temp.check('V04e existing user without photo hidden after grace',
    (select count(*) from public_profile where id = c) = 0);
  perform pg_temp.as_super();
  update app_settings set value = to_jsonb('2026-10-27'::text) where key = 'photo_grace_until';
  insert into profile_photos (user_id, storage_path, sort_order, is_primary) values (c, c || '/p0.jpg', 0, true);

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

  -- ---------- D01-D08: 見送り/検索カテゴリ (UI/UX A-3) ----------
  perform pg_temp.as_user(c);
  perform pass_user(a);
  perform pg_temp.check('D01 pass_user hides target from recommend_users',
    (select count(*) from recommend_users(10) r where r.id = a) = 0
    and (select count(*) from passes where user_id = c and target_user_id = a) = 1);
  perform pg_temp.check('D02 passed user still appears in search_profiles',
    (select count(*) from search_profiles('{}'::jsonb, 1, 50) s where s.id = a) = 1);
  perform undo_pass(a);
  perform pg_temp.check('D03 undo_pass restores recommendation',
    (select count(*) from recommend_users(10) r where r.id = a) = 1);
  perform pass_user(a);
  perform pg_temp.as_super();
  update passes set created_at = now() - interval '30 days' where user_id = c and target_user_id = a;
  perform pg_temp.as_user(c);
  perform pg_temp.check('D04 pass expires after pass_cooldown_days',
    (select count(*) from recommend_users(10) r where r.id = a) = 1);
  begin
    insert into passes (user_id, target_user_id) values (a, b);
    perform pg_temp.check('D05 cannot insert pass for others', false);
  exception when others then
    perform pg_temp.check('D05 cannot insert pass for others', true);
  end;
  perform pg_temp.as_user(a);
  perform pg_temp.check('D06 cannot read others passes', (select count(*) from passes) = 0);
  begin
    perform pass_user(a);
    perform pg_temp.check('D07 cannot pass self', false);
  exception when others then
    perform pg_temp.check('D07 cannot pass self', true);
  end;
  perform pg_temp.as_user(c);
  perform pg_temp.check('D08 search_profiles joined_within_days / sort=new',
    (select count(*) from search_profiles('{"joined_within_days": 1, "sort": "new"}'::jsonb, 1, 50)) >= 2
    and (select count(*) from search_profiles('{"joined_within_days": 0}'::jsonb, 1, 50)) = 0);
  perform pg_temp.check('D09 public_settings exposes pass_cooldown_days',
    (public_settings()->>'pass_cooldown_days')::int = 7);

  -- ---------- S01-S08: 設定/同意/一覧 RPC (UI/UX A-1) ----------
  perform pg_temp.as_user(a);
  perform pg_temp.check('S01 public_settings exposes only allowed keys',
    (public_settings() ? 'terms_version') and not (public_settings() ? 'invite_only'));
  insert into user_settings (user_id, auto_translate) values (a, true);
  perform pg_temp.check('S02 owner can insert/read own user_settings',
    (select auto_translate from user_settings where user_id = a) = true);
  begin
    insert into user_settings (user_id, auto_translate) values (b, true);
    perform pg_temp.check('S03 cannot insert user_settings for others', false);
  exception when others then
    perform pg_temp.check('S03 cannot insert user_settings for others', true);
  end;
  perform pg_temp.as_user(b);
  perform pg_temp.check('S04 cannot read other user_settings', (select count(*) from user_settings) = 0);
  perform pg_temp.as_user(a);
  perform record_consent(array['terms','privacy','age'], 'ja');
  perform pg_temp.check('S05 record_consent writes own rows',
    (select count(*) from user_consents where user_id = a) = 3
    and (select bool_and(is_current) from my_consent_status()));
  begin
    insert into user_consents (user_id, kind, version) values (a, 'terms', 'x');
    perform pg_temp.check('S06 direct insert into user_consents denied', false);
  exception when others then
    perform pg_temp.check('S06 direct insert into user_consents denied', true);
  end;
  perform pg_temp.as_user(b);
  perform pg_temp.check('S07 cannot read other consents', (select count(*) from user_consents) = 0);
  perform pg_temp.as_user(a);
  perform pg_temp.check('S08 my_conversations returns peer + unread=0 for sender',
    (select count(*) from my_conversations() where peer_id = b and unread_count = 0) = 1);
  perform pg_temp.as_user(b);
  perform pg_temp.check('S08b my_conversations unread=0 for receiver after mark_conversation_read',
    (select unread_count from my_conversations() where peer_id = a) = 0);
  perform pg_temp.as_user(a);
  insert into messages (conversation_id, sender_id, body) values (v_conv, a, '2件目');
  perform pg_temp.as_user(b);
  perform pg_temp.check('S08d my_conversations unread=1 after new message',
    (select unread_count from my_conversations() where peer_id = a) = 1
    and (select last_message_preview from my_conversations() where peer_id = a) = '2件目');
  perform pg_temp.as_user(c);
  perform pg_temp.check('S08c third party gets no conversations', (select count(*) from my_conversations()) = 0);

  -- ---------- T01-T08: 翻訳 (message_translations / translation_usage / ai_assisted) ----------
  perform pg_temp.as_user(a);
  begin
    insert into message_translations (message_id, target_lang, translated_body)
      select id, 'ko', 'x' from messages where conversation_id = v_conv limit 1;
    perform pg_temp.check('T01 participant cannot insert translation directly (server only)', false);
  exception when insufficient_privilege then
    perform pg_temp.check('T01 participant cannot insert translation directly (server only)', true);
  end;
  begin
    insert into translation_usage (user_id, kind, target_lang, chars) values (a, 'draft', 'ko', 5);
    perform pg_temp.check('T02 user cannot insert translation_usage', false);
  exception when insufficient_privilege then
    perform pg_temp.check('T02 user cannot insert translation_usage', true);
  end;
  perform pg_temp.as_super();
  insert into message_translations (message_id, target_lang, translated_body, provider)
    select id, 'ko', '안녕하세요', 'mock' from messages where conversation_id = v_conv and body = 'こんにちは';
  insert into translation_usage (user_id, kind, target_lang, chars, provider) values (a, 'message', 'ko', 5, 'mock');
  perform pg_temp.as_user(b);
  perform pg_temp.check('T03 participant can read cached translation',
    (select count(*) from message_translations where target_lang = 'ko') = 1);
  perform pg_temp.check('T04 original body unchanged after translation',
    (select count(*) from messages where conversation_id = v_conv and body = 'こんにちは') = 1);
  perform pg_temp.as_user(c);
  perform pg_temp.check('T05 third party cannot read translations', (select count(*) from message_translations) = 0);
  perform pg_temp.check('T06 third party cannot read others translation_usage', (select count(*) from translation_usage) = 0);
  perform pg_temp.as_user(a);
  perform pg_temp.check('T07 my_translation_usage counts own usage and exposes limits',
    (select used_today from my_translation_usage()) = 1 and (select per_day from my_translation_usage()) = 200);
  insert into messages (conversation_id, sender_id, body, body_lang, ai_assisted) values (v_conv, a, '안녕하세요!', 'ko', true);
  perform pg_temp.as_user(b);
  perform pg_temp.check('T08 ai_assisted flag visible to receiver',
    (select ai_assisted from messages where conversation_id = v_conv and body = '안녕하세요!') = true);
  perform pg_temp.check('T09 public_settings exposes translation settings',
    (public_settings()->>'translation_provider') is not null and (public_settings()->'translation_limits'->>'per_day')::int = 200);

  -- ---------- R10/R13: ブロック ----------
  perform pg_temp.as_user(b);
  insert into blocks (blocker_id, blocked_id) values (b, a);
  perform pg_temp.as_super();
  perform pg_temp.check('R10a block deactivates match + withdraws likes',
    (select is_active from matches where id = v_match) = false
    and (select count(*) from likes where status = 'active' and from_user_id in (a,b) and to_user_id in (a,b)) = 0);
  perform pg_temp.as_user(a);
  perform pg_temp.check('R13 blocked user cannot see block row', (select count(*) from blocks) = 0);
  perform pg_temp.check('S09 my_blocks empty for blocked side', (select count(*) from my_blocks()) = 0);
  perform pg_temp.as_user(b);
  perform pg_temp.check('S09b my_blocks lists blocked user for blocker',
    (select count(*) from my_blocks() where blocked_id = a) = 1);
  perform pg_temp.as_user(a);
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

  -- ---------- V10-V18: 本人確認申請 RPC / 書類ストレージ (UI/UX A-2) ----------
  perform pg_temp.as_super();
  -- アップロード済み書類を模擬 (Storage API の代わりに storage.objects へ直接挿入)
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('verification-docs', a || '/doc1.jpg', a, a::text, '{"mimetype":"image/jpeg"}'),
         ('verification-docs', b || '/doc1.jpg', b, b::text, '{"mimetype":"image/jpeg"}');

  perform pg_temp.as_user(a);
  perform pg_temp.check('V10 own verification doc readable',
    (select count(*) from storage.objects where bucket_id = 'verification-docs' and name = a || '/doc1.jpg') = 1);
  perform pg_temp.check('V11 other user verification doc hidden',
    (select count(*) from storage.objects where bucket_id = 'verification-docs' and name = b || '/doc1.jpg') = 0);
  begin
    perform request_verification('山田 太郎', '1995-01-01', b || '/doc1.jpg');
    perform pg_temp.check('V12 cannot submit with someone else doc path', false);
  exception when check_violation then
    perform pg_temp.check('V12 cannot submit with someone else doc path', true);
  end;
  begin
    perform request_verification('山田 太郎', '1995-01-01', a || '/missing.jpg');
    perform pg_temp.check('V13 cannot submit with non-uploaded doc', false);
  exception when check_violation then
    perform pg_temp.check('V13 cannot submit with non-uploaded doc', true);
  end;
  begin
    perform request_verification('', '1995-01-01', a || '/doc1.jpg');
    perform pg_temp.check('V14 name required', false);
  exception when check_violation then
    perform pg_temp.check('V14 name required', true);
  end;
  perform request_verification('山田 太郎', '1995-01-01', a || '/doc1.jpg');
  perform pg_temp.check('V15 request_verification -> pending with doc_path',
    (select status = 'pending' and doc_path = a || '/doc1.jpg' and submitted_name = '山田 太郎' and attempt_count = 1
       from verifications where user_id = a));
  begin
    perform request_verification('山田 太郎', '1995-01-01', a || '/doc1.jpg');
    perform pg_temp.check('V16 duplicate submit while pending rejected', false);
  exception when unique_violation then
    perform pg_temp.check('V16 duplicate submit while pending rejected', true);
  end;
  perform pg_temp.as_user(b);
  perform pg_temp.check('V17 other user cannot see my verification row',
    (select count(*) from verifications where user_id = a) = 0);
  perform pg_temp.check('V17b public_profile has no verification doc/name columns',
    (select count(*) from information_schema.columns where table_name = 'public_profile'
       and column_name in ('doc_path', 'submitted_name', 'submitted_birthdate')) = 0);
  perform pg_temp.as_user(adm);
  perform admin_set_verification(a, 'rejected', '画像が不鮮明');
  perform pg_temp.as_user(a);
  perform request_verification('山田 太郎', '1995-01-01', a || '/doc1.jpg');
  perform pg_temp.check('V18 re-apply after rejection -> pending, attempt_count=2, reason cleared',
    (select status = 'pending' and attempt_count = 2 and rejected_reason is null from verifications where user_id = a));
  perform pg_temp.as_user(adm);
  perform admin_set_verification(a, 'verified');
  perform pg_temp.as_super();
  alter table verifications disable trigger verifications_set_updated_at;
  update verifications set updated_at = now() - interval '100 days' where user_id = a;
  alter table verifications enable trigger verifications_set_updated_at;
  perform pg_temp.as_user(b);
  begin
    perform admin_purge_verification_docs();
    perform pg_temp.check('V19 non-admin cannot purge docs', false);
  exception when insufficient_privilege then
    perform pg_temp.check('V19 non-admin cannot purge docs', true);
  end;
  perform pg_temp.as_user(adm);
  n := admin_purge_verification_docs();
  perform pg_temp.check('V19b admin_purge_verification_docs removes expired doc',
    n = 1 and (select doc_path is null from verifications where user_id = a)
    and (select count(*) from storage.objects where bucket_id = 'verification-docs' and name = a || '/doc1.jpg') = 0);

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


  -- ---------- L01-L22: 交流サロン (S1) ----------
  -- 前提: b が a をブロック中。a/b/c は active, adm は admin。
  perform pg_temp.as_user(c);
  perform pg_temp.check('L01 categories: 3 active themes visible',
    (select count(*) from salon_categories where is_active) = 3);
  insert into salon_posts (author_id, category_id, title, body, body_lang) values (c, 'travel_food', '釜山のおすすめ', '海雲台の屋台が最高でした', 'ja') returning id into v_post;
  perform pg_temp.check('L02 free member can post', (select count(*) from salon_posts where id = v_post) = 1);
  begin
    insert into salon_posts (author_id, category_id, title, body) values (a, 'free_talk', 'x', 'y');
    perform pg_temp.check('L03 cannot post as another user', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L03 cannot post as another user', true);
  end;
  insert into salon_posts (author_id, category_id, title, body) values (c, 'free_talk', '連絡先', 'LINE ID: hello123 追加して') returning id into v_post2;
  perform pg_temp.check('L04 solicitation detected -> flagged (not deleted)',
    (select flagged and deleted_at is null from salon_posts where id = v_post2));

  -- a: 閲覧・コメント・リアクション
  perform pg_temp.as_user(a);
  perform pg_temp.check('L05 other member sees post via feed with author info',
    (select count(*) from salon_feed('new') where id = v_post and author_nickname = 'C') = 1);
  insert into salon_comments (post_id, author_id, body, body_lang) values (v_post, a, '私も行きました！', 'ja') returning id into v_comment;
  insert into salon_reactions (post_id, user_id) values (v_post, a);
  perform pg_temp.check('L06 comment/reaction counters + reacted flag',
    (select comment_count = 1 and reaction_count = 1 from salon_posts where id = v_post)
    and (select reacted from salon_feed('new') where id = v_post));
  perform pg_temp.check('L06b salon_post_detail returns post with author + reacted',
    (select count(*) from salon_post_detail(v_post) where author_nickname = 'C' and reacted) = 1);
  begin
    update salon_posts set title = 'hacked' where id = v_post;
    perform pg_temp.check('L07 cannot edit others post (0 rows)', (select title from salon_posts where id = v_post) = '釜山のおすすめ');
  exception when insufficient_privilege then
    perform pg_temp.check('L07 cannot edit others post (0 rows)', true);
  end;
  begin
    update salon_posts set is_hidden = true where id = v_post;
    perform pg_temp.check('L08 member cannot update is_hidden column', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L08 member cannot update is_hidden column', true);
  end;
  begin
    insert into salon_translations (target_type, target_id, target_lang, translated_body) values ('post_body', v_post, 'ko', 'x');
    perform pg_temp.check('L09 member cannot write translation cache', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L09 member cannot write translation cache', true);
  end;

  -- 投稿者 c: 通知・自分の編集・削除
  perform pg_temp.as_user(c);
  perform pg_temp.check('L10 author notified of comment + reaction',
    (select count(*) from notifications where user_id = c and type = 'salon_comment') = 1
    and (select count(*) from notifications where user_id = c and type = 'salon_reaction') = 1
    and my_salon_unread() = 2);
  update salon_posts set body = '海雲台の屋台が最高でした。写真は後で' where id = v_post;
  perform pg_temp.check('L11 author can edit own post', (select body like '%写真%' from salon_posts where id = v_post));

  -- ブロック: b は a をブロックしている → b には a のコメントが見えない / a の投稿が見えない
  perform pg_temp.as_user(a);
  insert into salon_posts (author_id, category_id, title, body) values (a, 'language_culture', 'a-post', 'hello') ;
  perform pg_temp.as_user(b);
  perform pg_temp.check('L12 blocker does not see blocked user post in feed',
    (select count(*) from salon_feed('new') where author_id = a) = 0);
  perform pg_temp.check('L12d blocker cannot open blocked user post detail',
    (select count(*) from salon_post_detail((select id from salon_posts where author_id = a and title = 'a-post'))) = 0);
  perform pg_temp.check('L12b blocker does not see blocked user comment',
    (select count(*) from salon_post_comments(v_post) where author_id = a) = 0
    and (select count(*) from salon_comments where post_id = v_post) = 0);
  perform pg_temp.as_user(a);
  perform pg_temp.check('L12c blocked side still sees unrelated posts', (select count(*) from salon_feed('new') where id = v_post) = 1);

  -- 通報 (投稿対象) と reported_user_id 整合性
  perform pg_temp.as_user(a);
  insert into reports (reporter_id, reported_user_id, reason, salon_post_id) values (a, c, 'spam', v_post2) returning id into v_report;
  perform pg_temp.check('L13 report salon post', (select count(*) from reports where id = v_report) = 1);
  begin
    insert into reports (reporter_id, reported_user_id, reason, salon_post_id) values (a, b, 'spam', v_post2);
    perform pg_temp.check('L14 report with mismatched author rejected', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L14 report with mismatched author rejected', true);
  end;
  begin
    perform admin_salon_moderate('post', v_post2, 'hide', 'spam');
    perform pg_temp.check('L15 non-admin cannot moderate', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L15 non-admin cannot moderate', true);
  end;

  -- 運営: 非表示 → 一般に見えない / 本人には見える / 復帰 / 削除 / 監査
  perform pg_temp.as_user(adm);
  perform pg_temp.check('L16 admin_salon_posts reported filter', (select count(*) from admin_salon_posts('reported') where id = v_post2) = 1);
  begin
    perform admin_salon_moderate('post', v_post2, 'hide', null);
    perform pg_temp.check('L17 hide requires reason', false);
  exception when others then
    perform pg_temp.check('L17 hide requires reason', true);
  end;
  perform admin_salon_moderate('post', v_post2, 'hide', '外部連絡先の誘導');
  perform pg_temp.as_user(a);
  perform pg_temp.check('L18 hidden post invisible to members', (select count(*) from salon_posts where id = v_post2) = 0
    and (select count(*) from salon_feed('new') where id = v_post2) = 0);
  begin
    insert into salon_comments (post_id, author_id, body) values (v_post2, a, 'x');
    perform pg_temp.check('L18b cannot comment on hidden post', false);
  exception when others then
    perform pg_temp.check('L18b cannot comment on hidden post', true);
  end;
  perform pg_temp.as_user(c);
  perform pg_temp.check('L19 author still sees own hidden post + moderation notice',
    (select is_hidden from salon_posts where id = v_post2)
    and (select count(*) from notifications where user_id = c and type = 'salon_moderation') = 1);
  perform pg_temp.as_user(adm);
  perform admin_salon_moderate('post', v_post2, 'unhide');
  perform pg_temp.as_user(a);
  perform pg_temp.check('L20 unhide restores visibility', (select count(*) from salon_posts where id = v_post2 and not is_hidden) = 1);
  perform pg_temp.as_user(adm);
  perform admin_salon_moderate('comment', v_comment, 'delete', '規約違反');
  perform pg_temp.check('L21 moderation actions + audit log recorded',
    (select count(*) from salon_moderation_actions where target_id in (v_post2, v_comment)) = 3
    and (select count(*) from admin_audit_logs where action like 'salon_%') = 3
    and (select comment_count from salon_posts where id = v_post) = 0);
  perform pg_temp.check('L22 admin_salon_stats works', (admin_salon_stats()->>'posts_total')::int >= 2);

  -- 本人ソフト削除 → 他人に見えない
  perform pg_temp.as_user(c);
  update salon_posts set deleted_at = now() where id = v_post;
  perform pg_temp.as_user(a);
  perform pg_temp.check('L23 soft-deleted post invisible to others', (select count(*) from salon_posts where id = v_post) = 0);

  -- 停止中会員は投稿不可
  perform pg_temp.as_super();
  update profiles set status = 'suspended', suspended_until = now() + interval '1 day' where id = c;
  perform pg_temp.as_user(c);
  begin
    insert into salon_posts (author_id, category_id, title, body) values (c, 'free_talk', 'x', 'y');
    perform pg_temp.check('L24 suspended member cannot post', false);
  exception when insufficient_privilege then
    perform pg_temp.check('L24 suspended member cannot post', true);
  end;
  perform pg_temp.as_user(a);
  perform pg_temp.check('L24b suspended author posts hidden from feed', (select count(*) from salon_feed('new') where author_id = c) = 0);
  perform pg_temp.as_super();
  update profiles set status = 'active', suspended_until = null where id = c;

  -- 投稿上限 (設定値)
  update app_settings set value = '1' where key = 'salon_post_per_day';
  perform pg_temp.as_user(b);
  insert into salon_posts (author_id, category_id, title, body) values (b, 'free_talk', 'b1', 'b1');
  begin
    insert into salon_posts (author_id, category_id, title, body) values (b, 'free_talk', 'b2', 'b2');
    perform pg_temp.check('L25 post per-day limit enforced from app_settings', false);
  exception when others then
    perform pg_temp.check('L25 post per-day limit enforced from app_settings', true);
  end;
  perform pg_temp.as_super();
  update app_settings set value = '5' where key = 'salon_post_per_day';

  perform pg_temp.as_super();
end $$;

select name, case when ok then 'PASS' else 'FAIL' end as result from t_results
union all
select 'TOTAL', format('%s passed, %s failed', count(*) filter (where ok), count(*) filter (where not ok)) from t_results
order by 1;

rollback;
