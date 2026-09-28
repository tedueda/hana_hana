-- P3: Stripe (テストモード) 連携
--   * billing_customers: user ↔ Stripe Customer
--   * stripe_events: Webhook 冪等 (event_id 主キー)
--   * payments: 返金列
--   * stripe_* RPC は service_role 専用 (Edge Function stripe-webhook から呼ぶ)。authenticated は実行不可
--   * my_billing(): 本人の契約・請求状況 (/app/plans/manage)
--   * admin_list_payments(): 運営向け決済一覧

create table if not exists billing_customers (
  user_id            uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  livemode           boolean not null default false,
  created_at         timestamptz not null default now()
);
alter table billing_customers enable row level security;
drop policy if exists billing_customers_select on billing_customers;
create policy billing_customers_select on billing_customers for select to authenticated using (user_id = auth.uid());

create table if not exists stripe_events (
  id           text primary key,
  type         text not null,
  livemode     boolean not null default false,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text
);
alter table stripe_events enable row level security;

alter table payments add column if not exists stripe_charge_id text;
alter table payments add column if not exists refunded_amount int not null default 0;
alter table payments add column if not exists refunded_at timestamptz;
alter table payments add column if not exists failure_message text;
create unique index if not exists payments_stripe_invoice_id_key on payments (stripe_invoice_id) where stripe_invoice_id is not null;

alter table subscriptions add column if not exists stripe_price_id text;
alter table subscriptions add column if not exists livemode boolean not null default false;

insert into app_settings (key, value) values
  ('stripe_mode', '"test"'),
  ('stripe_portal_configuration_id', 'null'),
  ('billing_allowed_origins', '["https://hana-hana.netlify.app","http://localhost:5173","http://localhost:5179"]')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Webhook 冪等: 初見なら true (処理を続行)、既処理なら false
-- ---------------------------------------------------------------------------
create or replace function stripe_begin_event(p_id text, p_type text, p_livemode boolean, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into stripe_events (id, type, livemode, payload) values (p_id, p_type, p_livemode, p_payload);
  return true;
exception when unique_violation then
  return (select processed_at is null and error is not null from stripe_events where id = p_id); -- 失敗済みは再処理を許可
end $$;

create or replace function stripe_finish_event(p_id text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update stripe_events set processed_at = case when p_error is null then now() end, error = p_error where id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Stripe Subscription → subscriptions 同期
-- Stripe の status: trialing/active/past_due/unpaid/canceled/incomplete/incomplete_expired/paused
-- ---------------------------------------------------------------------------
create or replace function stripe_map_status(p text) returns subscription_status_t
language sql immutable as $$
  select case p
    when 'trialing' then 'trialing'::subscription_status_t
    when 'active' then 'active'
    when 'past_due' then 'past_due'
    when 'unpaid' then 'past_due'
    when 'incomplete' then 'incomplete'
    else 'canceled'
  end;
$$;

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
-- 請求 (invoice) → payments
-- ---------------------------------------------------------------------------
create or replace function stripe_record_payment(
  p_customer text, p_subscription text, p_invoice text, p_payment_intent text, p_charge text,
  p_amount int, p_currency text, p_status text, p_paid_at timestamptz, p_failure_message text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_sub uuid; v_id uuid;
begin
  select user_id into v_user from billing_customers where stripe_customer_id = p_customer;
  if v_user is null then raise exception 'unknown_customer %', p_customer; end if;
  select id into v_sub from subscriptions where stripe_subscription_id = p_subscription;

  insert into payments (user_id, subscription_id, stripe_invoice_id, stripe_payment_intent_id, stripe_charge_id, amount, currency, status, paid_at, failure_message)
  values (v_user, v_sub, p_invoice, p_payment_intent, p_charge, p_amount, p_currency, p_status, p_paid_at, p_failure_message)
  on conflict (stripe_invoice_id) where stripe_invoice_id is not null do update set
    subscription_id = coalesce(excluded.subscription_id, payments.subscription_id),
    stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, payments.stripe_payment_intent_id),
    stripe_charge_id = coalesce(excluded.stripe_charge_id, payments.stripe_charge_id),
    amount = excluded.amount, status = excluded.status,
    paid_at = coalesce(excluded.paid_at, payments.paid_at), failure_message = excluded.failure_message
  returning id into v_id;

  if v_sub is not null then
    update subscriptions set latest_invoice_status = p_status where id = v_sub;
  end if;
  return v_id;
end $$;

create or replace function stripe_record_refund(p_charge text, p_payment_intent text, p_refunded_amount int, p_refunded_at timestamptz)
returns void language sql security definer set search_path = public as $$
  update payments set refunded_amount = p_refunded_amount, refunded_at = p_refunded_at,
                      status = case when p_refunded_amount >= amount then 'refunded' else 'partially_refunded' end
  where (stripe_charge_id = p_charge and p_charge is not null)
     or (stripe_payment_intent_id = p_payment_intent and p_payment_intent is not null);
$$;

-- service_role 専用
revoke all on function stripe_begin_event(text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function stripe_finish_event(text, text) from public, anon, authenticated;
revoke all on function stripe_sync_subscription(uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, text, boolean) from public, anon, authenticated;
revoke all on function stripe_record_payment(text, text, text, text, text, int, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function stripe_record_refund(text, text, int, timestamptz) from public, anon, authenticated;
grant execute on function stripe_begin_event(text, text, boolean, jsonb), stripe_finish_event(text, text),
  stripe_sync_subscription(uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, text, boolean),
  stripe_record_payment(text, text, text, text, text, int, text, text, timestamptz, text),
  stripe_record_refund(text, text, int, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 本人向け: 契約・請求状況
-- ---------------------------------------------------------------------------
create or replace function my_billing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
  v_plan plans%rowtype;
begin
  select * into v_sub from subscriptions
  where user_id = auth.uid() and status in ('trialing','active','past_due','incomplete')
  order by case status when 'active' then 0 when 'trialing' then 1 when 'past_due' then 2 else 3 end, current_period_end desc nulls last
  limit 1;
  if v_sub.id is not null then select * into v_plan from plans where id = v_sub.plan_id; end if;

  return jsonb_build_object(
    'tier', current_plan_tier(auth.uid()),
    'mode', (select value #>> '{}' from app_settings where key = 'stripe_mode'),
    'has_customer', exists (select 1 from billing_customers where user_id = auth.uid()),
    'subscription', case when v_sub.id is null then null else jsonb_build_object(
      'id', v_sub.id, 'plan_code', v_plan.code, 'plan_tier', v_sub.plan_tier, 'price_jpy', v_plan.price_jpy,
      'status', v_sub.status, 'current_period_end', v_sub.current_period_end,
      'cancel_at_period_end', v_sub.cancel_at_period_end, 'canceled_at', v_sub.canceled_at,
      'latest_invoice_status', v_sub.latest_invoice_status, 'is_stripe', v_sub.stripe_subscription_id is not null) end,
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'currency', p.currency, 'status', p.status, 'paid_at', p.paid_at,
        'created_at', p.created_at, 'refunded_amount', p.refunded_amount, 'failure_message', p.failure_message) order by p.created_at desc)
      from (select * from payments where user_id = auth.uid() order by created_at desc limit 12) p), '[]'::jsonb)
  );
end $$;
grant execute on function my_billing() to authenticated;

-- ---------------------------------------------------------------------------
-- 運営向け: 決済一覧
-- ---------------------------------------------------------------------------
create or replace function admin_list_payments(p_limit int default 100)
returns table (id uuid, user_id uuid, nickname text, amount int, currency text, status text, paid_at timestamptz,
               refunded_amount int, created_at timestamptz, stripe_invoice_id text, plan_tier plan_tier_t)
language sql stable security definer set search_path = public as $$
  select p.id, p.user_id, pr.nickname, p.amount, p.currency, p.status, p.paid_at, p.refunded_amount, p.created_at, p.stripe_invoice_id, s.plan_tier
  from payments p join profiles pr on pr.id = p.user_id left join subscriptions s on s.id = p.subscription_id
  where is_admin()
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function admin_list_payments(int) to authenticated;

-- public_settings に stripe_mode を追加 (test/live 表示用)
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
    'plan_limits','message_rate_per_minute','search_advanced_min_tier','stripe_mode'
  );
$$;
