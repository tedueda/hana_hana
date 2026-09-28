-- 料金体系 v2 (事業提���書「6. 料金体系」の反映)
--
--   * プラン段階を free / light / standard に改める (旧 standard→light, 旧 premium→standard)。
--     enum 値と plans.code を改名するだけで、subscriptions.plan_tier 等の既存行はそのまま追従する。
--   * 女性会員は全機能無料: app_settings.free_full_access_genders (既定 ["female"]) に該当する
--     会員は current_plan_tier() が最上位プランを返す。課金上の契約段階は subscribed_plan_tier()。
--   * 上限は app_settings.plan_limits (仮置き、変更可)。いいねは日次 (likes_per_day) と
--     月次 (likes_per_month) の両方を任意に設定できる。0 = 利用不可、null/未設定 = 無制限。
--   * 機能フラグ (plans.features): verified_search (本人確認済み検索)、photo_view_max
--     (相手の写真を何枚まで閲覧できるか。null = 無制限。マッチ済み相手は常に全枚)。
--     写真の可視性は profile_photos の RLS と Storage ポリシーの両方で判定する。
--   * 価格: ライト ¥1,000 / スタンダード ¥2,980 (税込)。Stripe Price は別途 plans.stripe_price_id に設定。

-- ---------------------------------------------------------------------------
-- 1. enum / plans の改名
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
             where t.typname = 'plan_tier_t' and e.enumlabel = 'premium') then
    alter type plan_tier_t rename value 'standard' to 'light';
    alter type plan_tier_t rename value 'premium' to 'standard';
  end if;
end $$;

update plans set code = 'light' where code = 'standard' and tier = 'light';
update plans set code = 'standard' where code = 'premium' and tier = 'standard';

update plans set
  name_ja = 'ライト', name_ko = '라이트', price_jpy = 1000, sort_order = 1,
  features = '{"footprints":false,"priority":false,"compatibility":false,
               "profile_polish":false,"event_discount_pct":0,"event_early_access":false,
               "verified_search":false,"photo_view_max":3}'::jsonb
where tier = 'light';

update plans set
  name_ja = 'スタンダード', name_ko = '스탠다드', price_jpy = 2980, sort_order = 2,
  features = '{"footprints":true,"priority":true,"compatibility":true,
               "profile_polish":true,"event_discount_pct":20,"event_early_access":true,
               "verified_search":true,"photo_view_max":null}'::jsonb
where tier = 'standard';

update plans set
  features = '{"footprints":false,"priority":false,"compatibility":false,
               "profile_polish":false,"event_discount_pct":0,"event_early_access":false,
               "verified_search":false,"photo_view_max":1}'::jsonb
where tier = 'free';

-- ---------------------------------------------------------------------------
-- 2. 設定 (仮置き・変更可)
-- ---------------------------------------------------------------------------
update app_settings set value = '{
  "free":     {"likes_per_day": 3,  "likes_per_month": null, "messages_per_month": 0,    "translations_per_day": 2},
  "light":    {"likes_per_day": null, "likes_per_month": 30, "messages_per_month": 10,   "translations_per_day": 5},
  "standard": {"likes_per_day": null, "likes_per_month": 100, "messages_per_month": null, "translations_per_day": 30}
}'::jsonb where key = 'plan_limits';

insert into app_settings (key, value) values
  ('free_full_access_genders', '["female"]'),
  ('invited_tier', '"light"'),
  ('event_price_guidance', '{"male":{"min":3000,"max":5000},"female":{"min":0,"max":1500}}')
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------------
-- 3. プラン判定
-- ---------------------------------------------------------------------------
create or replace function top_plan_tier() returns plan_tier_t
language sql stable security definer set search_path = public as $$
  select coalesce((select tier from plans where is_active order by sort_order desc limit 1), 'standard');
$$;

create or replace function plan_exempt(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p, app_settings s
    where p.id = p_user and s.key = 'free_full_access_genders'
      and p.gender is not null
      and s.value ? p.gender::text
  );
$$;

-- 課金上の契約段階 (subscription / invited のみ。性別免除は含めない)
create or replace function subscribed_plan_tier(p_user uuid) returns plan_tier_t
language plpgsql stable security definer set search_path = public as $$
declare
  v_tier  plan_tier_t;
  v_grace int := coalesce((select (value)::int from app_settings where key = 'past_due_grace_days'), 7);
  v_mt    member_tier_t;
begin
  select coalesce(s.plan_tier, p.tier) into v_tier
  from subscriptions s
  left join plans p on p.id = s.plan_id
  where s.user_id = p_user
    and (
      s.status in ('trialing','active')
      or (s.status = 'past_due' and coalesce(s.current_period_end, s.updated_at) + make_interval(days => v_grace) > now())
    )
    and (s.current_period_end is null or s.current_period_end + make_interval(days => v_grace) > now())
  order by (select pl.sort_order from plans pl where pl.tier = coalesce(s.plan_tier, p.tier) limit 1) desc nulls last
  limit 1;
  if v_tier is not null then return v_tier; end if;

  select member_tier into v_mt from profiles where id = p_user;
  if v_mt = 'invited' then
    return coalesce((select (value #>> '{}')::plan_tier_t from app_settings where key = 'invited_tier'), 'free');
  end if;
  return 'free';
end $$;

-- 権限判定に使う実効段階 (免除対象は最上位)
create or replace function current_plan_tier(p_user uuid) returns plan_tier_t
language sql stable security definer set search_path = public as $$
  select case when plan_exempt(p_user) then top_plan_tier() else subscribed_plan_tier(p_user) end;
$$;

grant execute on function top_plan_tier(), plan_exempt(uuid), subscribed_plan_tier(uuid) to authenticated, service_role;

-- 表示用 member_tier は契約段階に基づく
create or replace function sync_member_tier_from_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t plan_tier_t := subscribed_plan_tier(new.user_id);
begin
  update profiles set member_tier = case when t <> 'free' then 'paid' else (case when member_tier = 'paid' then 'free' else member_tier end) end
   where id = new.user_id;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. 利用状況 / 上限 (いいね月次を追加)
-- ---------------------------------------------------------------------------
create or replace function my_plan_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t plan_tier_t := current_plan_tier(auth.uid());
begin
  return jsonb_build_object(
    'tier', t,
    'subscribed_tier', subscribed_plan_tier(auth.uid()),
    'exempt', plan_exempt(auth.uid()),
    'likes_today',       (select count(*) from likes where from_user_id = auth.uid() and status = 'active' and updated_at >= usage_day_start()),
    'likes_per_day',     plan_limit(t, 'likes_per_day'),
    'likes_month',       (select count(*) from likes where from_user_id = auth.uid() and status = 'active' and updated_at >= usage_month_start()),
    'likes_per_month',   plan_limit(t, 'likes_per_month'),
    'messages_month',    (select count(*) from messages where sender_id = auth.uid() and created_at >= usage_month_start()),
    'messages_per_month', plan_limit(t, 'messages_per_month'),
    'translations_today',(select count(*) from translation_usage where user_id = auth.uid() and not cached and created_at >= usage_day_start()),
    'translations_per_day', plan_limit(t, 'translations_per_day'),
    'subscription', (select to_jsonb(x) from (
        select s.status, s.plan_tier, s.current_period_end, s.cancel_at_period_end, s.latest_invoice_status
        from subscriptions s where s.user_id = auth.uid()
        order by s.updated_at desc limit 1) x)
  );
end $$;

create or replace function enforce_like_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tier  plan_tier_t;
  v_day   int;
  v_month int;
  v_used  int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  if is_admin() then return new; end if;
  v_tier  := current_plan_tier(new.from_user_id);
  v_day   := plan_limit(v_tier, 'likes_per_day');
  v_month := plan_limit(v_tier, 'likes_per_month');
  if v_day is not null then
    select count(*) into v_used from likes
     where from_user_id = new.from_user_id and status = 'active' and updated_at >= usage_day_start() and id <> new.id;
    if v_used >= v_day then
      raise exception 'like_limit_reached' using errcode = 'P0001',
        detail = json_build_object('limit', v_day, 'period', 'day', 'tier', v_tier)::text, hint = 'plan_limit';
    end if;
  end if;
  if v_month is not null then
    select count(*) into v_used from likes
     where from_user_id = new.from_user_id and status = 'active' and updated_at >= usage_month_start() and id <> new.id;
    if v_used >= v_month then
      raise exception 'like_limit_reached' using errcode = 'P0001',
        detail = json_build_object('limit', v_month, 'period', 'month', 'tier', v_tier)::text, hint = 'plan_limit';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 5. 写真閲覧制限 (features.photo_view_max)
-- ---------------------------------------------------------------------------
create or replace function photo_visible_to_me(p_owner uuid, p_photo uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_max int;
  v_rank int;
begin
  if p_owner = auth.uid() or is_admin() then return true; end if;
  if not profile_visible_to_me(p_owner) then return false; end if;
  if are_matched(auth.uid(), p_owner) then return true; end if;
  select case when jsonb_typeof(p.features -> 'photo_view_max') = 'number' then (p.features ->> 'photo_view_max')::int end
    into v_max
  from plans p where p.tier = current_plan_tier(auth.uid()) and p.is_active
  order by p.sort_order desc limit 1;
  if v_max is null then return true; end if;
  select rank into v_rank from (
    select id, row_number() over (order by is_primary desc, sort_order, created_at) rank
    from profile_photos where user_id = p_owner
  ) r where r.id = p_photo;
  return coalesce(v_rank, 0) <= v_max;
end $$;
grant execute on function photo_visible_to_me(uuid, uuid) to authenticated;

drop policy if exists profile_photos_select on profile_photos;
create policy profile_photos_select on profile_photos for select to authenticated
  using (photo_visible_to_me(user_id, id));

drop policy if exists "profile_photos_read" on storage.objects;
create policy "profile_photos_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and exists (
      select 1 from profile_photos ph
      where ph.storage_path = name and photo_visible_to_me(ph.user_id, ph.id)
    )
  );

-- 相手の写真の総枚数 (制限で隠れている枚数の表示用)
create or replace function profile_photo_count(p_owner uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when profile_visible_to_me(p_owner)
    then (select count(*)::int from profile_photos where user_id = p_owner) else 0 end;
$$;
grant execute on function profile_photo_count(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 本人確認済み検索 (features.verified_search)
-- ---------------------------------------------------------------------------
create or replace function search_profiles(filters jsonb default '{}'::jsonb, page int default 1, size int default 20)
returns table (id uuid, score int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_size int := greatest(1, least(size, 50));
  v_sort text := coalesce(filters->>'sort', 'active');
begin
  if coalesce((filters->>'verified_only')::boolean, false)
     and not is_admin() and not plan_has_feature(auth.uid(), 'verified_search') then
    raise exception 'plan_feature_required' using errcode = '42501', detail = '{"feature":"verified_search"}';
  end if;
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
-- 6b. Stripe 同期: 旧価格 (改定前) の契約イベントは既存契約のプランで同期する
-- ---------------------------------------------------------------------------
create or replace function stripe_sync_subscription(
  p_user uuid, p_customer text, p_subscription text, p_price text, p_status text,
  p_period_start timestamptz, p_period_end timestamptz, p_cancel_at_period_end boolean,
  p_canceled_at timestamptz, p_latest_invoice_status text, p_livemode boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_plan plans%rowtype;
  v_id uuid;
begin
  if p_user is null then
    select user_id into p_user from billing_customers where stripe_customer_id = p_customer;
  end if;
  if p_user is null then raise exception 'unknown_customer %', p_customer; end if;

  insert into billing_customers (user_id, stripe_customer_id, livemode) values (p_user, p_customer, p_livemode)
  on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;

  select * into v_plan from plans where stripe_price_id = p_price;
  if v_plan.id is null then
    -- 価格改定で紐づけが外れた既存契約 (解約イベント等) は従来のプランのまま状態だけ同期する
    select p.* into v_plan from subscriptions s join plans p on p.id = s.plan_id
    where s.stripe_subscription_id = p_subscription;
  end if;
  if v_plan.id is null then raise exception 'unknown_price %', p_price; end if;

  insert into subscriptions (user_id, plan_id, plan_tier, stripe_customer_id, stripe_subscription_id, stripe_price_id, status,
                             current_period_start, current_period_end, cancel_at_period_end, canceled_at, latest_invoice_status, livemode)
  values (p_user, v_plan.id, v_plan.tier, p_customer, p_subscription, p_price, stripe_map_status(p_status),
          p_period_start, p_period_end, coalesce(p_cancel_at_period_end, false), p_canceled_at, p_latest_invoice_status, p_livemode)
  on conflict (stripe_subscription_id) do update set
    plan_id = excluded.plan_id, plan_tier = excluded.plan_tier, stripe_price_id = excluded.stripe_price_id,
    status = excluded.status, current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, canceled_at = excluded.canceled_at,
    latest_invoice_status = coalesce(excluded.latest_invoice_status, subscriptions.latest_invoice_status)
  returning id into v_id;

  -- 同一ユーザーの他の有効な手動/旧契約は閉じる (Stripe 契約が正)
  update subscriptions set status = 'canceled', canceled_at = coalesce(canceled_at, now())
  where user_id = p_user and id <> v_id and status in ('trialing','active','past_due','incomplete')
    and (stripe_subscription_id is null or stripe_subscription_id <> p_subscription);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. 公開設定 / 運営集計
-- ---------------------------------------------------------------------------
create or replace function public_settings()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_settings
  where key in (
    'terms_version','privacy_version','min_age','photo_required','photo_grace_until',
    'verification_provider','verification_doc_retention_days',
    'translation_enabled','translation_auto_enabled','translation_limits','translation_provider',
    'require_verification_for_like','max_profile_photos','account_purge_days',
    'pass_cooldown_days','new_member_days',
    'salon_enabled','salon_post_per_day','salon_comment_per_minute','salon_comment_per_day','salon_photo_enabled',
    'plan_limits','message_rate_per_minute','search_advanced_min_tier','stripe_mode',
    'free_full_access_genders','event_price_guidance'
  );
$$;

create or replace function admin_plan_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_tier', (select coalesce(jsonb_object_agg(t, c), '{}'::jsonb) from (
        select subscribed_plan_tier(id)::text t, count(*) c from profiles where deleted_at is null and status = 'active' group by 1) x),
    'exempt', (select count(*) from profiles where deleted_at is null and status = 'active' and plan_exempt(id)),
    'subs_active',   (select count(*) from subscriptions where status in ('active','trialing')),
    'subs_past_due', (select count(*) from subscriptions where status = 'past_due'),
    'subs_cancel_scheduled', (select count(*) from subscriptions where status in ('active','trialing') and cancel_at_period_end),
    'subs_canceled_30d', (select count(*) from subscriptions where status = 'canceled' and updated_at >= now() - interval '30 days'),
    'payments_failed_30d', (select count(*) from payments where status in ('failed','payment_failed') and created_at >= now() - interval '30 days'),
    'revenue_30d', (select coalesce(sum(amount), 0) from payments where status in ('paid','succeeded') and paid_at >= now() - interval '30 days')
  );
end $$;
