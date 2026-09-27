-- 実行: SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/seed_demo_users.sql
-- デモ用ダミー会員 4 名 (JP2/KR2, メール確認済み・パスワード Hanahana-Test1)。
-- 写真は profile-photos バケットに `<user_id>/main.jpg` を別途アップロードする (scripts/upload_demo_photos.py)。
-- 本番運用開始前に削除すること。
do $$
declare
  ids uuid[] := array['d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002',
                      'd1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000004']::uuid[];
  emails text[] := array['demo-jp1@hanahana.test','demo-jp2@hanahana.test','demo-kr1@hanahana.test','demo-kr2@hanahana.test'];
  nicks text[] := array['さくら','ユウキ','지우','민준'];
  genders gender_t[] := array['female','male','female','male']::gender_t[];
  births date[] := array['1996-04-12','1993-11-02','1998-08-21','1995-02-14']::date[];
  nats nationality_t[] := array['JP','JP','KR','KR']::nationality_t[];
  res country_t[] := array['JP','JP','KR','JP']::country_t[];
  region_codes text[] := array['13','27','11','13'];
  occs text[] := array['カフェ店員','ITエンジニア','대학원생','디자이너'];
  bios text[] := array[
    '韓国ドラマと料理が好きです。ソウルに行くのが夢！韓国語は勉強中なので、一緒に話しながら教え合えたら嬉しいです。',
    '大阪でエンジニアをしています。週末はカフェ巡りと写真。韓国旅行で釜山が好きになりました。まずは気軽にチャットから。',
    '서울에서 일본어를 공부하는 대학원생이에요. 일본 영화와 라멘을 좋아합니다. 언어 교환하면서 친해지고 싶어요 🙂',
    '도쿄에서 디자이너로 일하고 있어요. 일본 생활 3년째. 주말엔 전시회나 등산을 갑니다. 편하게 이야기 나눠요!'
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
      occupation = occs[i], bio = bios[i], meeting_pref = 'online_first',
      pref_gender = array[prefs[i]]::gender_t[], pref_age_min = 22, pref_age_max = 40,
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
    (ids[2],'ja','native','native'),(ids[2],'ko','learning','intermediate'),
    (ids[3],'ko','native','native'),(ids[3],'ja','learning','intermediate'),
    (ids[4],'ko','native','native'),(ids[4],'ja','learning','advanced')
  on conflict do nothing;
  insert into user_consents (user_id, kind, version, ui_lang)
  select ids[n], k, '2026-09', case when n <= 2 then 'ja' else 'ko' end
  from generate_series(1,4) n, unnest(array['terms','privacy','age']) k
  where not exists (select 1 from user_consents c where c.user_id = ids[n] and c.kind = k);
end $$;
select u.email, p.nickname, p.onboarding_completed, p.is_public, (select count(*) from profile_photos ph where ph.user_id = p.id) photos
from auth.users u join profiles p on p.id = u.id where u.email like 'demo-%' order by u.email;
