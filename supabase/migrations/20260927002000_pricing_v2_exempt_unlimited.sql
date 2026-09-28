-- 料金体系 v2 補足: 課金対象外 (plan_exempt = 女性会員など) は回数上限も無制限にする
--   * user_plan_limit(user, key): exempt → null (無制限)、それ以外は plan_limit(current_plan_tier(user), key)
--   * my_plan_usage / enforce_like_limit / enforce_message_limit / translation_quota が参照
--   * 機能フラグ (plans.features) は従来どおり current_plan_tier() = 最上位プランで判定

create or replace function user_plan_limit(p_user uuid, p_key text) returns integer
language sql stable security definer set search_path = public as $$
  select case when plan_exempt(p_user) then null
              else plan_limit(current_plan_tier(p_user), p_key) end;
$$;
grant execute on function user_plan_limit(uuid, text) to authenticated, service_role;

create or replace function my_plan_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  t plan_tier_t := current_plan_tier(u);
begin
  return jsonb_build_object(
    'tier', t,
    'subscribed_tier', subscribed_plan_tier(u),
    'exempt', plan_exempt(u),
    'likes_today',       (select count(*) from likes where from_user_id = u and status = 'active' and updated_at >= usage_day_start()),
    'likes_per_day',     user_plan_limit(u, 'likes_per_day'),
    'likes_month',       (select count(*) from likes where from_user_id = u and status = 'active' and updated_at >= usage_month_start()),
    'likes_per_month',   user_plan_limit(u, 'likes_per_month'),
    'messages_month',    (select count(*) from messages where sender_id = u and created_at >= usage_month_start()),
    'messages_per_month', user_plan_limit(u, 'messages_per_month'),
    'translations_today',(select count(*) from translation_usage where user_id = u and not cached and created_at >= usage_day_start()),
    'translations_per_day', user_plan_limit(u, 'translations_per_day'),
    'subscription', (select to_jsonb(x) from (
        select s.status, s.plan_tier, s.current_period_end, s.cancel_at_period_end, s.latest_invoice_status
        from subscriptions s where s.user_id = u
        order by s.updated_at desc limit 1) x)
  );
end $$;

create or replace function translation_quota(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tier', current_plan_tier(p_user),
    'per_day', user_plan_limit(p_user, 'translations_per_day'),
    'has_plan_limit', plan_exempt(p_user)
      or exists (select 1 from app_settings where key = 'plan_limits' and value -> current_plan_tier(p_user)::text ? 'translations_per_day'),
    'day_start', usage_day_start()
  );
$$;

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
  v_day   := user_plan_limit(new.from_user_id, 'likes_per_day');
  v_month := user_plan_limit(new.from_user_id, 'likes_per_month');
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
  v_limit := user_plan_limit(new.sender_id, 'messages_per_month');
  if v_limit is null then return new; end if;
  select count(*) into v_used from messages where sender_id = new.sender_id and created_at >= usage_month_start();
  if v_used >= v_limit then
    raise exception 'message_limit_reached' using errcode = 'P0001',
      detail = json_build_object('limit', v_limit, 'tier', v_tier)::text, hint = 'plan_limit';
  end if;
  return new;
end $$;
