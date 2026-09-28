-- P1: 会員プラン基盤
--   * plan_tier_t = free / standard / premium
--   * plans に価格(税込 JPY)・tier・機能説明を追加し 3 行 seed (価格・上限は DB 値でコード固定しない)
--   * current_plan_tier(uid): 有効な subscriptions → plans.tier。無ければ招待特典 (app_settings.invited_tier) → free
--   * app_settings.plan_limits: プラン別の いいね/日・メッセージ/月・AI翻訳/日 (null = 無制限)
--   * サーバー側判定: likes / messages の before insert トリガー、translate Edge Function は plan_limit() を参照
--   * 上限到達後も SELECT は無変更 (履歴は読める)

do $$ begin
  create type plan_tier_t as enum ('free','standard','premium');
exception when duplicate_object then null; end $$;

alter table plans add column if not exists tier        plan_tier_t not null default 'free';
alter table plans add column if not exists price_jpy   integer not null default 0 check (price_jpy >= 0);
alter table plans add column if not exists currency    text not null default 'jpy';
alter table plans add column if not exists sort_order  integer not null default 0;
alter table plans add column if not exists features    jsonb not null default '{}'::jsonb;
create unique index if not exists plans_tier_active on plans (tier) where is_active;

insert into plans (code, name_ja, name_ko, interval, is_active, tier, price_jpy, currency, sort_order, features) values
  ('free',     '無料',        '무료',     null,    true, 'free',     0,   'jpy', 0, '{"footprints":false,"priority":false,"compatibility":false,"profile_polish":false,"event_discount_pct":0,"event_early_access":false}'),
  ('standard', 'スタンダード', '스탠다드', 'month', true, 'standard', 500, 'jpy', 1, '{"footprints":false,"priority":false,"compatibility":false,"profile_polish":false,"event_discount_pct":0,"event_early_access":true}'),
  ('premium',  'プレミアム',   '프리미엄', 'month', true, 'premium',  980, 'jpy', 2, '{"footprints":true,"priority":true,"compatibility":true,"profile_polish":true,"event_discount_pct":20,"event_early_access":true}')
on conflict (code) do update set
  tier = excluded.tier, price_jpy = excluded.price_jpy, currency = excluded.currency,
  sort_order = excluded.sort_order, features = excluded.features, interval = excluded.interval;

alter table subscriptions add column if not exists plan_tier plan_tier_t;
alter table subscriptions add column if not exists latest_invoice_status text;
alter table subscriptions add column if not exists canceled_at timestamptz;

-- 上限・猶予の設定 (仮置き。事業者判断で変更)
insert into app_settings (key, value) values
  ('plan_limits', '{
     "free":     {"likes_per_day": 10,  "messages_per_month": 10,   "translations_per_day": 2},
     "standard": {"likes_per_day": 50,  "messages_per_month": 100,  "translations_per_day": 10},
     "premium":  {"likes_per_day": 100, "messages_per_month": null, "translations_per_day": 50}
   }'),
  ('message_rate_per_minute', '20'),
  ('past_due_grace_days', '7'),
  ('invited_tier', '"standard"'),
  ('search_advanced_min_tier', '"free"'),
  ('usage_timezone', '"Asia/Tokyo"')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- プラン判定 (security definer: subscriptions は本人以外不可視のため)
-- ---------------------------------------------------------------------------
create or replace function current_plan_tier(p_user uuid) returns plan_tier_t
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
  order by case coalesce(s.plan_tier, p.tier) when 'premium' then 2 when 'standard' then 1 else 0 end desc
  limit 1;
  if v_tier is not null then return v_tier; end if;

  select member_tier into v_mt from profiles where id = p_user;
  if v_mt = 'invited' then
    return coalesce((select (value #>> '{}')::plan_tier_t from app_settings where key = 'invited_tier'), 'free');
  end if;
  return 'free';
end $$;

create or replace function my_plan_tier() returns plan_tier_t
language sql stable security definer set search_path = public as $$
  select current_plan_tier(auth.uid());
$$;

-- プラン別上限 (null = 無制限)
create or replace function plan_limit(p_tier plan_tier_t, p_key text) returns integer
language sql stable security definer set search_path = public as $$
  select case
    when jsonb_typeof(v.value -> p_tier::text -> p_key) = 'number' then (v.value -> p_tier::text ->> p_key)::int
    else null
  end
  from app_settings v where v.key = 'plan_limits';
$$;

create or replace function usage_day_start() returns timestamptz
language sql stable security definer set search_path = public as $$
  select (date_trunc('day', now() at time zone coalesce((select (value #>> '{}') from app_settings where key = 'usage_timezone'), 'UTC')))
         at time zone coalesce((select (value #>> '{}') from app_settings where key = 'usage_timezone'), 'UTC');
$$;

create or replace function usage_month_start() returns timestamptz
language sql stable security definer set search_path = public as $$
  select (date_trunc('month', now() at time zone coalesce((select (value #>> '{}') from app_settings where key = 'usage_timezone'), 'UTC')))
         at time zone coalesce((select (value #>> '{}') from app_settings where key = 'usage_timezone'), 'UTC');
$$;

-- 本人の利用状況 (UI 表示用)
create or replace function my_plan_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t plan_tier_t := current_plan_tier(auth.uid());
begin
  return jsonb_build_object(
    'tier', t,
    'likes_today',       (select count(*) from likes where from_user_id = auth.uid() and status = 'active' and updated_at >= usage_day_start()),
    'likes_per_day',     plan_limit(t, 'likes_per_day'),
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

-- translate Edge Function (service_role) 用: プラン別の翻訳日次上限
create or replace function translation_quota(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tier', current_plan_tier(p_user),
    'per_day', plan_limit(current_plan_tier(p_user), 'translations_per_day'),
    'has_plan_limit', exists (select 1 from app_settings where key = 'plan_limits' and value -> current_plan_tier(p_user)::text ? 'translations_per_day'),
    'day_start', usage_day_start()
  );
$$;
grant execute on function translation_quota(uuid) to service_role;

-- UI の残回数表示もプラン別上限を返す (null = 無制限)
create or replace function my_translation_usage()
returns table (used_today integer, used_last_minute integer, per_day integer, per_minute integer, max_chars integer)
language sql stable security definer set search_path = public as $$
  with lim as (
    select coalesce((select value from app_settings where key = 'translation_limits'),
                    '{"max_chars":1000,"per_minute":10,"per_day":200}'::jsonb) v
  ), q as (select translation_quota(auth.uid()) j)
  select
    (select count(*)::int from translation_usage u where u.user_id = auth.uid() and not u.cached and u.created_at >= usage_day_start()),
    (select count(*)::int from translation_usage u where u.user_id = auth.uid() and not u.cached and u.created_at >= now() - interval '1 minute'),
    (select case when (j->>'has_plan_limit')::bool then (j->>'per_day')::int else (select (v->>'per_day')::int from lim) end from q),
    (select (v->>'per_minute')::int from lim),
    (select (v->>'max_chars')::int from lim);
$$;

grant execute on function current_plan_tier(uuid), my_plan_tier(), plan_limit(plan_tier_t, text),
  usage_day_start(), usage_month_start(), my_plan_usage() to authenticated;
grant execute on function current_plan_tier(uuid), plan_limit(plan_tier_t, text), usage_day_start(), usage_month_start() to service_role;

-- ---------------------------------------------------------------------------
-- サーバー側上限: いいね (日次)
-- ---------------------------------------------------------------------------
create or replace function enforce_like_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tier  plan_tier_t;
  v_limit int;
  v_used  int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;
  if is_admin() then return new; end if;
  v_tier := current_plan_tier(new.from_user_id);
  v_limit := plan_limit(v_tier, 'likes_per_day');
  if v_limit is null then return new; end if;
  select count(*) into v_used from likes
   where from_user_id = new.from_user_id and status = 'active' and updated_at >= usage_day_start()
     and id <> new.id;
  if v_used >= v_limit then
    raise exception 'like_limit_reached' using errcode = 'P0001',
      detail = json_build_object('limit', v_limit, 'tier', v_tier)::text, hint = 'plan_limit';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists likes_enforce_limit on likes;
create trigger likes_enforce_limit before insert or update of status on likes
  for each row execute function enforce_like_limit();

-- ---------------------------------------------------------------------------
-- サーバー側上限: メッセージ (月次 + 全プラン共通の速度制限)
-- ---------------------------------------------------------------------------
create or replace function enforce_message_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tier  plan_tier_t;
  v_limit int;
  v_used  int;
  v_rate  int := coalesce((select value::int from app_settings where key = 'message_rate_per_minute'), 20);
begin
  if is_admin() then return new; end if;
  select count(*) into v_used from messages where sender_id = new.sender_id and created_at >= now() - interval '1 minute';
  if v_used >= v_rate then
    raise exception 'message_rate_limited' using errcode = 'P0001', hint = 'rate_limit';
  end if;
  v_tier := current_plan_tier(new.sender_id);
  v_limit := plan_limit(v_tier, 'messages_per_month');
  if v_limit is null then return new; end if;
  select count(*) into v_used from messages where sender_id = new.sender_id and created_at >= usage_month_start();
  if v_used >= v_limit then
    raise exception 'message_limit_reached' using errcode = 'P0001',
      detail = json_build_object('limit', v_limit, 'tier', v_tier)::text, hint = 'plan_limit';
  end if;
  return new;
end $$;

drop trigger if exists messages_enforce_limit on messages;
create trigger messages_enforce_limit before insert on messages
  for each row execute function enforce_message_limit();

-- ---------------------------------------------------------------------------
-- 互換: 有効な有料 subscription がある場合は profiles.member_tier='paid' を同期 (表示用途のみ、権限判定には使わない)
-- ---------------------------------------------------------------------------
create or replace function sync_member_tier_from_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t plan_tier_t := current_plan_tier(new.user_id);
begin
  update profiles set member_tier = case when t <> 'free' then 'paid' else (case when member_tier = 'paid' then 'free' else member_tier end) end
   where id = new.user_id;
  return new;
end $$;
drop trigger if exists subscriptions_sync_member_tier on subscriptions;
create trigger subscriptions_sync_member_tier after insert or update on subscriptions
  for each row execute function sync_member_tier_from_subscription();

-- ---------------------------------------------------------------------------
-- 公開設定にプラン関連を追加
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
    'plan_limits','message_rate_per_minute','search_advanced_min_tier'
  );
$$;

-- 運営: プラン別集計
create or replace function admin_plan_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_tier', (select coalesce(jsonb_object_agg(t, c), '{}'::jsonb) from (
        select current_plan_tier(id)::text t, count(*) c from profiles where deleted_at is null and status = 'active' group by 1) x),
    'subs_active',   (select count(*) from subscriptions where status in ('active','trialing')),
    'subs_past_due', (select count(*) from subscriptions where status = 'past_due'),
    'subs_cancel_scheduled', (select count(*) from subscriptions where status in ('active','trialing') and cancel_at_period_end),
    'subs_canceled_30d', (select count(*) from subscriptions where status = 'canceled' and updated_at >= now() - interval '30 days'),
    'payments_failed_30d', (select count(*) from payments where status in ('failed','payment_failed') and created_at >= now() - interval '30 days'),
    'revenue_30d', (select coalesce(sum(amount), 0) from payments where status in ('paid','succeeded') and paid_at >= now() - interval '30 days')
  );
end $$;
grant execute on function admin_plan_stats() to authenticated;
