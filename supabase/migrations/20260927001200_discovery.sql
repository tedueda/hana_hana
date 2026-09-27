-- 段階A-3: 発見・検索
--  * passes: 「見送り」を一定期間だけおすすめから除外 (取り消し可、在庫を永久に減らさない)
--  * search_profiles: カテゴリ (新しく参加 / 学習言語) と並び順
--  * user_settings.saved_search: 検索条件の保存
--  * app_settings: pass_cooldown_days / new_member_days

insert into app_settings (key, value) values
  ('pass_cooldown_days', '7'),
  ('new_member_days',    '14')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- passes
-- ---------------------------------------------------------------------------
create table if not exists passes (
  user_id        uuid not null references profiles(id) on delete cascade,
  target_user_id uuid not null references profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, target_user_id),
  check (user_id <> target_user_id)
);
create index if not exists passes_user_created_idx on passes (user_id, created_at desc);

alter table passes enable row level security;
drop policy if exists passes_select on passes;
create policy passes_select on passes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists passes_insert on passes;
create policy passes_insert on passes for insert to authenticated
  with check (user_id = auth.uid() and is_active_member());
drop policy if exists passes_delete on passes;
create policy passes_delete on passes for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on passes to authenticated;

-- 見送り: 既存行があれば created_at を更新 (クールダウンをやり直す)
create or replace function pass_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_active_member() then
    raise exception 'not an active member' using errcode = '42501';
  end if;
  if p_target is null or p_target = auth.uid() then
    raise exception 'invalid target' using errcode = '23514';
  end if;
  insert into passes (user_id, target_user_id) values (auth.uid(), p_target)
  on conflict (user_id, target_user_id) do update set created_at = now();
  insert into user_events (user_id, target_user_id, event_type)
  values (auth.uid(), p_target, 'skip');
end $$;
grant execute on function pass_user(uuid) to authenticated;

create or replace function undo_pass(p_target uuid) returns void
language sql security definer set search_path = public as $$
  delete from passes where user_id = auth.uid() and target_user_id = p_target;
$$;
grant execute on function undo_pass(uuid) to authenticated;

create or replace function is_passed_recently(p_user uuid, p_target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from passes ps
    where ps.user_id = p_user and ps.target_user_id = p_target
      and ps.created_at > now() - make_interval(
        days => coalesce((select (value #>> '{}')::int from app_settings where key = 'pass_cooldown_days'), 7))
  );
$$;

-- ---------------------------------------------------------------------------
-- recommend_users: 見送り中を除外 (スコアリングは既存のまま)
-- ---------------------------------------------------------------------------
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
      and not is_passed_recently(me.id, p.id)
  ),
  scored as (
    select
      c.id,
      case when me.pref_gender is null or c.gender = any(me.pref_gender)
           then coalesce((w->>'gender')::int, 30) else 0 end as s_gender,
      case when c.pref_gender is null or me.gender = any(c.pref_gender)
           then coalesce((w->>'gender_mutual')::int, 20) else 0 end as s_gender_mutual,
      case when me.pref_nationality is not null and c.nationality = any(me.pref_nationality)
             then coalesce((w->>'nationality')::int, 25)
           when me.pref_nationality is null and me.nationality is distinct from c.nationality
             and me.nationality in ('JP','KR') and c.nationality in ('JP','KR')
             then coalesce((w->>'nationality')::int, 25)
           else 0 end as s_nationality,
      case when extract(year from age(c.birthdate)) between coalesce(me.pref_age_min, 18) and coalesce(me.pref_age_max, 99)
           then coalesce((w->>'age')::int, 15) else 0 end as s_age,
      (select count(*) from user_languages a join user_languages b
          on a.language_code = b.language_code
       where a.user_id = me.id and b.user_id = c.id
         and ((a.role = 'learning' and b.role = 'native') or (a.role = 'native' and b.role = 'learning')))::int
        * coalesce((w->>'language')::int, 20) as s_language,
      least((select count(*) from user_interests a join user_interests b on a.interest_id = b.interest_id
             where a.user_id = me.id and b.user_id = c.id), 5)::int
        * coalesce((w->>'interest')::int, 5) as s_interest,
      least((select count(*) from user_purposes a join user_purposes b on a.purpose_id = b.purpose_id
             where a.user_id = me.id and b.user_id = c.id), 3)::int
        * coalesce((w->>'purpose')::int, 10) as s_purpose,
      case when me.residence_region_id is not null and me.residence_region_id = c.residence_region_id
             then coalesce((w->>'region')::int, 10)
           when me.residence_country = c.residence_country then coalesce((w->>'country')::int, 5)
           else 0 end as s_region,
      case when me.meeting_pref is not null and me.meeting_pref = c.meeting_pref
           then coalesce((w->>'meeting_pref')::int, 5) else 0 end as s_meeting,
      case when c.last_active_at > now() - interval '7 days' then coalesce((w->>'recent')::int, 5) else 0 end as s_recent,
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
-- search_profiles: joined_within_days / sort ('active' | 'new')
-- ---------------------------------------------------------------------------
create or replace function search_profiles(filters jsonb default '{}'::jsonb, page int default 1, size int default 20)
returns table (id uuid, score int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_size int := greatest(1, least(size, 50));
  v_sort text := coalesce(filters->>'sort', 'active');
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
    and (filters->>'joined_within_days' is null
         or p.created_at > now() - make_interval(days => (filters->>'joined_within_days')::int))
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
  order by
    case when v_sort = 'new' then p.created_at end desc nulls last,
    p.last_active_at desc nulls last, p.created_at desc
  limit v_size offset (greatest(page, 1) - 1) * v_size;
end $$;

-- ---------------------------------------------------------------------------
-- 検索条件の保存
-- ---------------------------------------------------------------------------
alter table user_settings add column if not exists saved_search jsonb;

-- ---------------------------------------------------------------------------
-- public_settings に追加
-- ---------------------------------------------------------------------------
create or replace function public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_settings
  where key in (
    'terms_version','privacy_version','min_age','photo_required','photo_grace_until',
    'verification_provider','verification_doc_retention_days',
    'translation_enabled','translation_auto_enabled','translation_limits',
    'require_verification_for_like','max_profile_photos','account_purge_days',
    'pass_cooldown_days','new_member_days'
  );
$$;
