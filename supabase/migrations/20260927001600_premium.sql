-- ===========================================================================
-- P2: プレミアム機能 (足あと / 優先表示 / 相性診断 / プロフィール添削・翻訳補助 / イベント最小版)
--   * 権限判定はすべてサーバー側: plan_has_feature(uid, key) が plans.features を
--     current_plan_tier() で解決する。フロントの表示は補助に過ぎない。
--   * 足あと: profile_views (閲覧者×被閲覧者×日)。記録は record_profile_view() 経由のみ。
--     一覧は features.footprints が true のプランのみ。それ以外は件数だけ返す。
--   * 優先表示: recommend_users のスコアに app_settings.priority_boost_score を加算し
--     reasons に 'priority' を付けて広告的露出を明示。ブロック・条件・安全制限は不変。
--   * 相性診断: compatibility(target) — 目的/言語交換/趣味/希望条件から 0–100 と理由。
--   * イベント: events / event_registrations。割引率は plans.features.event_discount_pct、
--     優先案内は features.event_early_access + events.early_access_hours。
-- ===========================================================================

insert into app_settings (key, value) values
  ('priority_boost_score',     '15'::jsonb),
  ('event_early_access_hours', '48'::jsonb),
  ('footprints_days',          '30'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- プラン機能フラグ
-- ---------------------------------------------------------------------------
create or replace function plan_has_feature(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (p.features ->> p_key)::boolean
    from plans p where p.tier = current_plan_tier(p_user) and p.is_active
    order by p.sort_order desc limit 1
  ), false);
$$;

create or replace function plan_feature_int(p_user uuid, p_key text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (p.features ->> p_key)::integer
    from plans p where p.tier = current_plan_tier(p_user) and p.is_active
    order by p.sort_order desc limit 1
  ), 0);
$$;

create or replace function my_plan_features() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.features || jsonb_build_object('tier', p.tier)
    from plans p where p.tier = current_plan_tier(auth.uid()) and p.is_active
    order by p.sort_order desc limit 1
  ), '{"tier":"free"}'::jsonb);
$$;

grant execute on function plan_has_feature(uuid, text), plan_feature_int(uuid, text), my_plan_features() to authenticated;
grant execute on function plan_has_feature(uuid, text), plan_feature_int(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 足あと
-- ---------------------------------------------------------------------------
create or replace function usage_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select (value #>> '{}') from app_settings where key = 'usage_timezone'), 'UTC'))::date;
$$;

create table if not exists profile_views (
  viewer_id      uuid not null references profiles(id) on delete cascade,
  viewed_id      uuid not null references profiles(id) on delete cascade,
  viewed_on      date not null default usage_today(),
  view_count     integer not null default 1,
  last_viewed_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id, viewed_on),
  check (viewer_id <> viewed_id)
);
create index if not exists profile_views_viewed_idx on profile_views (viewed_id, last_viewed_at desc);
alter table profile_views enable row level security;
-- 直接の読み書きは与えない (RPC 経由のみ)
revoke all on profile_views from anon, authenticated;

create or replace function record_profile_view(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_target is null or me = p_target then return; end if;
  if not exists (
    select 1 from profiles p where p.id = me and p.status = 'active' and p.deleted_at is null
  ) then return; end if;
  if not exists (select 1 from candidate_profiles() c where c.id = p_target) then return; end if;

  insert into profile_views (viewer_id, viewed_id)
  values (me, p_target)
  on conflict (viewer_id, viewed_id, viewed_on)
  do update set view_count = profile_views.view_count + 1, last_viewed_at = now();

  insert into user_events (user_id, target_user_id, event_type) values (me, p_target, 'view');
end $$;

create or replace function my_footprints_summary() returns jsonb
language sql stable security definer set search_path = public as $$
  with d as (select coalesce((select (value #>> '{}')::int from app_settings where key = 'footprints_days'), 30) days)
  select jsonb_build_object(
    'unlocked', plan_has_feature(auth.uid(), 'footprints'),
    'days', (select days from d),
    'viewer_count', (
      select count(distinct v.viewer_id)
      from profile_views v
      join candidate_profiles() c on c.id = v.viewer_id
      where v.viewed_id = auth.uid()
        and v.last_viewed_at >= now() - make_interval(days => (select days from d))
    )
  );
$$;

create or replace function my_footprints(p_limit int default 50)
returns table (viewer_id uuid, last_viewed_at timestamptz, view_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := coalesce((select (value #>> '{}')::int from app_settings where key = 'footprints_days'), 30);
begin
  if not plan_has_feature(auth.uid(), 'footprints') then
    raise exception 'premium_required' using errcode = '42501', detail = '{"feature":"footprints"}';
  end if;
  return query
    select v.viewer_id, max(v.last_viewed_at), sum(v.view_count)::bigint
    from profile_views v
    join candidate_profiles() c on c.id = v.viewer_id
    where v.viewed_id = auth.uid()
      and v.last_viewed_at >= now() - make_interval(days => v_days)
    group by v.viewer_id
    order by max(v.last_viewed_at) desc
    limit greatest(1, least(p_limit, 200));
end $$;

grant execute on function record_profile_view(uuid), my_footprints_summary(), my_footprints(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 相性診断 (0–100)
-- ---------------------------------------------------------------------------
create or replace function compatibility(p_target uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me       profiles%rowtype;
  tg       profiles%rowtype;
  s_purpose int := 0; s_lang int := 0; s_interest int := 0; s_pref int := 0;
  n int;
  reasons text[] := '{}';
  tg_age int; me_age int;
begin
  if not plan_has_feature(auth.uid(), 'compatibility') then
    return jsonb_build_object('unlocked', false);
  end if;
  select * into me from profiles where id = auth.uid();
  select * into tg from candidate_profiles() where id = p_target;
  if tg.id is null then
    raise exception 'profile_not_available' using errcode = 'P0002';
  end if;

  -- 目的の一致 (最大30)
  select count(*) into n from user_purposes a join user_purposes b on a.purpose_id = b.purpose_id
    where a.user_id = me.id and b.user_id = tg.id;
  s_purpose := least(n, 2) * 15;
  if n > 0 then reasons := array_append(reasons, 'shared_purpose'); end if;

  -- 言語交換 (学習⇄母語) (最大30)
  select count(*) into n from user_languages a join user_languages b on a.language_code = b.language_code
    where a.user_id = me.id and b.user_id = tg.id
      and ((a.role = 'learning' and b.role = 'native') or (a.role = 'native' and b.role = 'learning'));
  s_lang := least(n, 2) * 15;
  if n > 0 then reasons := array_append(reasons, 'language_exchange'); end if;

  -- 共通の趣味 (最大20)
  select count(*) into n from user_interests a join user_interests b on a.interest_id = b.interest_id
    where a.user_id = me.id and b.user_id = tg.id;
  s_interest := least(n, 4) * 5;
  if n > 0 then reasons := array_append(reasons, 'shared_interests'); end if;

  -- 希望条件の相互一致 (最大20: 性別 8 / 年齢 6 / 国籍 6)
  if (me.pref_gender is null or tg.gender = any(me.pref_gender))
     and (tg.pref_gender is null or me.gender = any(tg.pref_gender)) then
    s_pref := s_pref + 8; reasons := array_append(reasons, 'gender_mutual');
  end if;
  tg_age := extract(year from age(tg.birthdate)); me_age := extract(year from age(me.birthdate));
  if tg_age between coalesce(me.pref_age_min, 18) and coalesce(me.pref_age_max, 99)
     and me_age between coalesce(tg.pref_age_min, 18) and coalesce(tg.pref_age_max, 99) then
    s_pref := s_pref + 6; reasons := array_append(reasons, 'age');
  end if;
  if (me.pref_nationality is null or tg.nationality = any(me.pref_nationality))
     and (tg.pref_nationality is null or me.nationality = any(tg.pref_nationality)) then
    s_pref := s_pref + 6; reasons := array_append(reasons, 'nationality');
  end if;
  if me.meeting_pref is not null and me.meeting_pref = tg.meeting_pref then
    reasons := array_append(reasons, 'meeting_pref');
  end if;

  return jsonb_build_object(
    'unlocked', true,
    'score', least(100, s_purpose + s_lang + s_interest + s_pref),
    'breakdown', jsonb_build_object('purpose', s_purpose, 'language', s_lang, 'interest', s_interest, 'preference', s_pref),
    'reasons', to_jsonb(reasons)
  );
end $$;
grant execute on function compatibility(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 優先表示: recommend_users に priority_boost を加算 (プレミアムの候補者)
-- ---------------------------------------------------------------------------
create or replace function recommend_users(p_limit int default 20)
returns table (id uuid, score int, reasons text[])
language plpgsql stable security definer set search_path = public as $$
declare
  me profiles%rowtype;
  w  jsonb;
  boost int := coalesce((select (value #>> '{}')::int from app_settings where key = 'priority_boost_score'), 15);
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
           then coalesce((w->>'verified')::int, 5) else 0 end as s_verified,
      case when plan_has_feature(c.id, 'priority') then boost else 0 end as s_priority
    from cand c
  )
  select
    s.id,
    (s.s_gender + s.s_gender_mutual + s.s_nationality + s.s_age + s.s_language
     + s.s_interest + s.s_purpose + s.s_region + s.s_meeting + s.s_recent + s.s_verified + s.s_priority) as score,
    array_remove(array[
      case when s.s_language   > 0 then 'language_exchange' end,
      case when s.s_interest   > 0 then 'shared_interests' end,
      case when s.s_purpose    > 0 then 'shared_purpose' end,
      case when s.s_region     > 0 then 'nearby' end,
      case when s.s_nationality> 0 then 'nationality' end,
      case when s.s_verified   > 0 then 'verified' end,
      case when s.s_priority   > 0 then 'priority' end
    ], null) as reasons
  from scored s
  order by score desc, random()
  limit greatest(1, least(p_limit, 50));
end $$;

-- ---------------------------------------------------------------------------
-- プロフィール添削・翻訳補助 (Edge Function translate の kind)
-- ---------------------------------------------------------------------------
alter table translation_usage drop constraint if exists translation_usage_kind_check;
alter table translation_usage add constraint translation_usage_kind_check
  check (kind in ('message','draft','salon_post','salon_comment','profile_polish','profile_translate'));

-- ---------------------------------------------------------------------------
-- イベント (最小版)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id                 uuid primary key default gen_random_uuid(),
  title_ja           text not null,
  title_ko           text not null,
  description_ja     text not null default '',
  description_ko     text not null default '',
  location_ja        text,
  location_ko        text,
  is_online          boolean not null default false,
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  capacity           integer check (capacity is null or capacity > 0),
  price_jpy          integer not null default 0 check (price_jpy >= 0),
  early_access_hours integer,
  published_at       timestamptz,
  canceled_at        timestamptz,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists events_starts_idx on events (starts_at);

do $$ begin
  create type event_registration_status_t as enum ('registered','canceled');
exception when duplicate_object then null; end $$;

create table if not exists event_registrations (
  event_id         uuid not null references events(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  status           event_registration_status_t not null default 'registered',
  quoted_price_jpy integer not null default 0,
  discount_pct     integer not null default 0,
  plan_tier        plan_tier_t not null default 'free',
  created_at       timestamptz not null default now(),
  canceled_at      timestamptz,
  primary key (event_id, user_id)
);
create index if not exists event_registrations_user_idx on event_registrations (user_id, created_at desc);

alter table events enable row level security;
alter table event_registrations enable row level security;

create policy events_select on events for select to authenticated
  using (published_at is not null and published_at <= now() or is_admin());
create policy events_admin_write on events for all to authenticated
  using (is_admin()) with check (is_admin());
create policy event_registrations_select on event_registrations for select to authenticated
  using (user_id = auth.uid() or is_admin());
-- 申込/キャンセルは RPC 経由のみ (INSERT/UPDATE ポリシー無し)

create or replace function event_price_for(p_user uuid, p_event uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'base', e.price_jpy,
    'discount_pct', plan_feature_int(p_user, 'event_discount_pct'),
    'price', (e.price_jpy * (100 - plan_feature_int(p_user, 'event_discount_pct')) + 99) / 100
  ) from events e where e.id = p_event;
$$;

create or replace function event_open_at(p_user uuid, p_event uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select case
    when plan_has_feature(p_user, 'event_early_access') then e.published_at
    else e.published_at + make_interval(hours => coalesce(e.early_access_hours,
           (select (value #>> '{}')::int from app_settings where key = 'event_early_access_hours'), 0))
  end
  from events e where e.id = p_event;
$$;

create or replace function list_events(p_scope text default 'upcoming')
returns table (
  id uuid, title_ja text, title_ko text, description_ja text, description_ko text,
  location_ja text, location_ko text, is_online boolean, starts_at timestamptz, ends_at timestamptz,
  capacity integer, price_jpy integer, my_price_jpy integer, my_discount_pct integer,
  early_access boolean, open_at timestamptz, registered_count bigint, my_status event_registration_status_t,
  canceled_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select e.id, e.title_ja, e.title_ko, e.description_ja, e.description_ko,
         e.location_ja, e.location_ko, e.is_online, e.starts_at, e.ends_at,
         e.capacity, e.price_jpy,
         ((event_price_for(auth.uid(), e.id) ->> 'price')::int),
         ((event_price_for(auth.uid(), e.id) ->> 'discount_pct')::int),
         plan_has_feature(auth.uid(), 'event_early_access'),
         event_open_at(auth.uid(), e.id),
         (select count(*) from event_registrations r where r.event_id = e.id and r.status = 'registered'),
         (select r.status from event_registrations r where r.event_id = e.id and r.user_id = auth.uid()),
         e.canceled_at
  from events e
  where e.published_at is not null and e.published_at <= now()
    and case p_scope
          when 'mine' then exists (select 1 from event_registrations r where r.event_id = e.id and r.user_id = auth.uid() and r.status = 'registered')
          when 'past' then e.starts_at < now()
          else e.starts_at >= now() - interval '1 day'
        end
  order by e.starts_at;
$$;

create or replace function register_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e events%rowtype;
  cnt int;
  pr jsonb;
begin
  select * into e from events where id = p_event and published_at is not null and published_at <= now();
  if e.id is null then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  if e.canceled_at is not null then raise exception 'event_canceled' using errcode = 'P0001'; end if;
  if e.starts_at < now() then raise exception 'event_started' using errcode = 'P0001'; end if;
  if not exists (select 1 from profiles p where p.id = me and p.status = 'active' and p.deleted_at is null and p.onboarding_completed) then
    raise exception 'inactive_member' using errcode = '42501';
  end if;
  if event_open_at(me, p_event) > now() then
    raise exception 'event_early_access' using errcode = '42501',
      detail = jsonb_build_object('open_at', event_open_at(me, p_event))::text;
  end if;
  select count(*) into cnt from event_registrations r where r.event_id = p_event and r.status = 'registered';
  if e.capacity is not null and cnt >= e.capacity
     and not exists (select 1 from event_registrations r where r.event_id = p_event and r.user_id = me and r.status = 'registered') then
    raise exception 'event_full' using errcode = 'P0001';
  end if;
  pr := event_price_for(me, p_event);
  insert into event_registrations (event_id, user_id, status, quoted_price_jpy, discount_pct, plan_tier)
  values (p_event, me, 'registered', (pr ->> 'price')::int, (pr ->> 'discount_pct')::int, current_plan_tier(me))
  on conflict (event_id, user_id) do update set
    status = 'registered', quoted_price_jpy = excluded.quoted_price_jpy, discount_pct = excluded.discount_pct,
    plan_tier = excluded.plan_tier, canceled_at = null, created_at = now();
end $$;

create or replace function cancel_event_registration(p_event uuid) returns void
language sql security definer set search_path = public as $$
  update event_registrations set status = 'canceled', canceled_at = now()
  where event_id = p_event and user_id = auth.uid() and status = 'registered';
$$;

grant execute on function list_events(text), register_event(uuid), cancel_event_registration(uuid) to authenticated;

-- 運営
create or replace function admin_upsert_event(p_event jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_event ->> 'id', '')::uuid;
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if v_id is null then
    insert into events (title_ja, title_ko, description_ja, description_ko, location_ja, location_ko, is_online,
                        starts_at, ends_at, capacity, price_jpy, early_access_hours, published_at, created_by)
    values (p_event ->> 'title_ja', p_event ->> 'title_ko',
            coalesce(p_event ->> 'description_ja', ''), coalesce(p_event ->> 'description_ko', ''),
            p_event ->> 'location_ja', p_event ->> 'location_ko', coalesce((p_event ->> 'is_online')::boolean, false),
            (p_event ->> 'starts_at')::timestamptz, (p_event ->> 'ends_at')::timestamptz,
            (p_event ->> 'capacity')::int, coalesce((p_event ->> 'price_jpy')::int, 0),
            (p_event ->> 'early_access_hours')::int,
            case when coalesce((p_event ->> 'published')::boolean, false) then now() end, auth.uid())
    returning id into v_id;
  else
    update events set
      title_ja = coalesce(p_event ->> 'title_ja', title_ja),
      title_ko = coalesce(p_event ->> 'title_ko', title_ko),
      description_ja = coalesce(p_event ->> 'description_ja', description_ja),
      description_ko = coalesce(p_event ->> 'description_ko', description_ko),
      location_ja = coalesce(p_event ->> 'location_ja', location_ja),
      location_ko = coalesce(p_event ->> 'location_ko', location_ko),
      is_online = coalesce((p_event ->> 'is_online')::boolean, is_online),
      starts_at = coalesce((p_event ->> 'starts_at')::timestamptz, starts_at),
      ends_at = case when p_event ? 'ends_at' then (p_event ->> 'ends_at')::timestamptz else ends_at end,
      capacity = case when p_event ? 'capacity' then (p_event ->> 'capacity')::int else capacity end,
      price_jpy = coalesce((p_event ->> 'price_jpy')::int, price_jpy),
      early_access_hours = case when p_event ? 'early_access_hours' then (p_event ->> 'early_access_hours')::int else early_access_hours end,
      published_at = case when p_event ? 'published' then
                       case when (p_event ->> 'published')::boolean then coalesce(published_at, now()) else null end
                     else published_at end,
      canceled_at = case when p_event ? 'canceled' then
                       case when (p_event ->> 'canceled')::boolean then coalesce(canceled_at, now()) else null end
                     else canceled_at end,
      updated_at = now()
    where id = v_id;
  end if;
  insert into admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'event_upsert', 'event', v_id::text, p_event);
  return v_id;
end $$;

create or replace function admin_event_registrations(p_event uuid)
returns table (user_id uuid, nickname text, status event_registration_status_t, quoted_price_jpy integer,
               discount_pct integer, plan_tier plan_tier_t, created_at timestamptz, canceled_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.nickname, r.status, r.quoted_price_jpy, r.discount_pct, r.plan_tier, r.created_at, r.canceled_at
  from event_registrations r join profiles p on p.id = r.user_id
  where r.event_id = p_event and is_admin()
  order by r.created_at;
$$;

grant execute on function admin_upsert_event(jsonb), admin_event_registrations(uuid) to authenticated;
