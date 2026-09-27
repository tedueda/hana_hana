-- 実行: SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/seed_e2e_users.sql
-- 本番環境では実行しないこと (テスト専用アカウント)。
-- E2E テストアカウント (メール確認済み・パスワード Hanahana-Test1)
do $$
declare
  ids uuid[] := array['a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004']::uuid[];
  emails text[] := array['e2e-jp1@hanahana.test','e2e-kr1@hanahana.test','e2e-kr2@hanahana.test','e2e-admin@hanahana.test'];
  nicks text[] := array['E2E太郎','E2E지민','E2E수아','E2E管理者'];
  i int;
begin
  for i in 1..4 loop
    if not exists (select 1 from auth.users where id = ids[i]) then
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values (ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', emails[i],
        crypt('Hanahana-Test1', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nickname', nicks[i]), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), ids[i], ids[i]::text, 'email',
        jsonb_build_object('sub', ids[i]::text, 'email', emails[i], 'email_verified', true), now(), now(), now());
    end if;
  end loop;
  -- KR ユーザーはプロフィール完成済み (JP1 はオンボーディングを UI で実施)
  update profiles set onboarding_completed = true, birthdate = '1997-03-03', gender = 'female', nationality = 'KR',
    residence_country = 'KR', bio = 'E2E 테스트 계정입니다', pref_gender = array['male']::gender_t[]
   where id = ids[2];
  update profiles set onboarding_completed = true, birthdate = '1999-07-07', gender = 'female', nationality = 'KR',
    residence_country = 'JP', bio = '日本語を勉強中です', pref_gender = array['male']::gender_t[]
   where id = ids[3];
  update profiles set onboarding_completed = true, birthdate = '1990-01-01', gender = 'other', nationality = 'JP',
    residence_country = 'JP' where id = ids[4];
  insert into user_languages values (ids[2],'ko','native','native'),(ids[2],'ja','learning','intermediate'),
                                    (ids[3],'ko','native','native'),(ids[3],'ja','learning','beginner')
  on conflict do nothing;
  insert into admin_users (user_id, role) values (ids[4], 'super_admin') on conflict (user_id) do update set role = 'super_admin';
end $$;
select email, (select onboarding_completed from profiles p where p.id = u.id) from auth.users u where email like 'e2e-%';
