-- 実行: SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/seed_demo_users.sql
-- デモ用会員 4 名 (日本人女性/男性・韓国人女性/男性)。メール確認済み・パスワード Hanahana-Test1。
-- 写真は supabase/assets/demo/*.jpg を profile-photos バケットの `<user_id>/main.jpg` へ
-- 別途アップロードする (scripts/upload_demo_photos.py)。
-- 本番運用開始前に削除すること。
do $$
declare
  ids uuid[] := array['d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002',
                      'd2000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000004']::uuid[];
  emails text[] := array['demo-saki@hanahana.test','demo-yuma@hanahana.test','demo-jieun@hanahana.test','demo-minjun@hanahana.test'];
  nicks text[] := array['咲希','悠真','지은','민준'];
  genders gender_t[] := array['female','male','female','male']::gender_t[];
  -- 2026-09 時点で 30 / 32 / 29 / 31 歳
  births date[] := array['1996-03-15','1994-05-20','1997-08-08','1995-06-10']::date[];
  nats nationality_t[] := array['JP','JP','KR','KR']::nationality_t[];
  res country_t[] := array['JP','JP','JP','KR']::country_t[];
  region_codes text[] := array['27','13','27','11'];   -- 大阪 / 東京 / 大阪 / ソウル
  bios text[] := array[
    '韓国語を勉強中。カフェ巡りと韓国映画が好きです。言葉や文化の違いを楽しみながら、気軽にお話しできる友達を探しています。',
    '韓国旅行をきっかけに韓国語を学び始めました。料理と街歩きが好きです。お互いのおすすめを紹介し合えるとうれしいです。',
    '日本語を勉強しています。本屋さんや喫茶店、散歩が好きです。韓国と日本の日常について、楽しくお話ししたいです。',
    '写真と建築、料理に興味があります。日本語でも韓国語でも、好きな街や文化について話せる仲間と出会いたいです。'
  ];
  prefs gender_t[] := array['male','female','male','female']::gender_t[];
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
    update profiles set
      nickname = nicks[i], gender = genders[i], birthdate = births[i], nationality = nats[i],
      residence_country = res[i],
      residence_region_id = (select id from regions r where r.country = res[i] and r.code = region_codes[i]),
      bio = bios[i], meeting_pref = 'online_first',
      pref_gender = array[prefs[i]]::gender_t[], pref_age_min = 24, pref_age_max = 40,
      is_public = true, onboarding_completed = true, onboarding_step = 7, status = 'active',
      preferred_ui_lang = case when nats[i] = 'JP' then 'ja' else 'ko' end,
      last_active_at = now() - (i || ' hours')::interval
    where id = ids[i];
    insert into profile_photos (user_id, storage_path, sort_order, is_primary)
    values (ids[i], ids[i]::text || '/main.jpg', 0, true)
    on conflict do nothing;
  end loop;
  insert into user_languages values
    (ids[1],'ja','native','native'),(ids[1],'ko','learning','beginner'),
    (ids[2],'ja','native','native'),(ids[2],'ko','learning','beginner'),
    (ids[3],'ko','native','native'),(ids[3],'ja','learning','intermediate'),
    (ids[4],'ko','native','native'),(ids[4],'ja','learning','intermediate')
  on conflict do nothing;
  insert into user_consents (user_id, kind, version, ui_lang)
  select ids[n], k, '2026-09-27', case when n <= 2 then 'ja' else 'ko' end
  from generate_series(1,4) n, unnest(array['terms','privacy','age']) k
  where not exists (select 1 from user_consents c where c.user_id = ids[n] and c.kind = k);
end $$;
select u.email, p.nickname, p.gender, p.nationality, extract(year from age(p.birthdate)) age, p.onboarding_completed, p.is_public,
  (select count(*) from profile_photos ph where ph.user_id = p.id) photos
from auth.users u join profiles p on p.id = u.id where u.email like 'demo-%' order by u.email;
