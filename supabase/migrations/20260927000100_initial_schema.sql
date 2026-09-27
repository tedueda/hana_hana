-- Hana-Hana (仮称) 初期スキーマ
-- 設計書: docs/hanahana/04_supabase_db_design.md

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------------------------
create type gender_t              as enum ('male','female','other','undisclosed');
create type nationality_t         as enum ('JP','KR','other');
create type country_t             as enum ('JP','KR','other');
create type language_level_t      as enum ('beginner','intermediate','advanced','native');
create type language_role_t       as enum ('native','learning');
create type meeting_pref_t        as enum ('online_only','online_first','meet_ok','travel_meet');
create type member_tier_t         as enum ('free','paid','invited');
create type account_status_t      as enum ('active','suspended','banned','deleted');
create type like_status_t         as enum ('active','withdrawn');
create type verification_status_t as enum ('unverified','pending','verified','rejected');
create type report_reason_t       as enum ('inappropriate_content','impersonation','harassment','fraud_suspected','inappropriate_photo','other');
create type report_status_t       as enum ('open','in_review','resolved','dismissed');
create type notification_type_t   as enum ('like','match','message','verification','system','announcement');
create type admin_role_t          as enum ('super_admin','moderator','support');
create type subscription_status_t as enum ('trialing','active','past_due','canceled','incomplete');

-- ---------------------------------------------------------------------------
-- 共通: updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 管理
-- ---------------------------------------------------------------------------
create table admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       admin_role_t not null default 'moderator',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table admin_audit_logs (
  id            bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb,
  ip            inet,
  created_at    timestamptz not null default now()
);
create index on admin_audit_logs (admin_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- マスター
-- ---------------------------------------------------------------------------
create table languages (
  code       text primary key,
  name_ja    text not null,
  name_ko    text not null,
  name_en    text not null,
  sort_order int  not null default 0,
  is_active  bool not null default true
);

create table interests (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_ja    text not null,
  name_ko    text not null,
  name_en    text not null,
  category   text,
  sort_order int  not null default 0,
  is_active  bool not null default true
);

create table purposes (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_ja    text not null,
  name_ko    text not null,
  name_en    text not null,
  sort_order int  not null default 0,
  is_active  bool not null default true
);

create table regions (
  id         uuid primary key default gen_random_uuid(),
  country    country_t not null,
  code       text not null,
  name_ja    text not null,
  name_ko    text not null,
  name_en    text not null,
  sort_order int  not null default 0,
  is_active  bool not null default true,
  unique (country, code)
);

create table plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name_ja         text not null,
  name_ko         text not null,
  stripe_price_id text,
  interval        text,
  is_active       bool not null default true
);

create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table invite_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  label         text,
  owner_user_id uuid references auth.users(id) on delete set null,
  max_uses      int,
  used_count    int  not null default 0,
  grants_tier   member_tier_t not null default 'invited',
  is_active     bool not null default true,
  expires_at    timestamptz,
  created_by    uuid references admin_users(user_id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ユーザー
-- ---------------------------------------------------------------------------
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  nickname             text check (nickname is null or char_length(nickname) between 1 and 20),
  gender               gender_t,
  birthdate            date check (birthdate is null or birthdate <= (current_date - interval '18 years')),
  nationality          nationality_t,
  residence_country    country_t,
  residence_region_id  uuid references regions(id),
  occupation           text,
  bio                  text check (bio is null or char_length(bio) <= 1000),
  meeting_pref         meeting_pref_t,
  pref_gender          gender_t[],
  pref_age_min         int check (pref_age_min is null or pref_age_min >= 18),
  pref_age_max         int check (pref_age_max is null or pref_age_max <= 99),
  pref_nationality     nationality_t[],
  is_public            bool not null default true,
  onboarding_completed bool not null default false,
  member_tier          member_tier_t not null default 'free',
  invite_code_id       uuid references invite_codes(id),
  status               account_status_t not null default 'active',
  suspended_until      timestamptz,
  status_reason        text,
  preferred_ui_lang    text not null default 'ja' references languages(code),
  last_active_at       timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on profiles (status, is_public, onboarding_completed);
create index on profiles (nationality);
create index on profiles (residence_country, residence_region_id);
create index on profiles (birthdate);
create index on profiles (gender);
create index on profiles (last_active_at desc);
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

create table profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  sort_order   int  not null default 0 check (sort_order between 0 and 4),
  is_primary   bool not null default false,
  created_at   timestamptz not null default now(),
  unique (user_id, sort_order)
);

create table user_languages (
  user_id       uuid not null references profiles(id) on delete cascade,
  language_code text not null references languages(code),
  role          language_role_t not null,
  level         language_level_t not null,
  primary key (user_id, language_code, role),
  check (role <> 'native' or level = 'native')
);

create table user_interests (
  user_id     uuid not null references profiles(id) on delete cascade,
  interest_id uuid not null references interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

create table user_purposes (
  user_id    uuid not null references profiles(id) on delete cascade,
  purpose_id uuid not null references purposes(id) on delete cascade,
  primary key (user_id, purpose_id)
);

-- ---------------------------------------------------------------------------
-- マッチング
-- ---------------------------------------------------------------------------
create table likes (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id) on delete cascade,
  to_user_id   uuid not null references profiles(id) on delete cascade,
  status       like_status_t not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);
create index on likes (to_user_id, status, created_at desc);
create index on likes (from_user_id, status, created_at desc);
create trigger likes_set_updated_at before update on likes
  for each row execute function set_updated_at();

create table matches (
  id           uuid primary key default gen_random_uuid(),
  user_low_id  uuid not null references profiles(id) on delete cascade,
  user_high_id uuid not null references profiles(id) on delete cascade,
  is_active    bool not null default true,
  matched_at   timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid references profiles(id),
  unique (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);
create index on matches (user_low_id, is_active);
create index on matches (user_high_id, is_active);

create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  match_id             uuid not null unique references matches(id) on delete cascade,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  body_lang       text,
  attachment_path text,
  read_at         timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at desc);
create index on messages (conversation_id, read_at) where read_at is null;

create table message_translations (
  message_id      uuid not null references messages(id) on delete cascade,
  target_lang     text not null,
  translated_body text not null,
  provider        text,
  created_at      timestamptz not null default now(),
  primary key (message_id, target_lang)
);

create table user_events (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references profiles(id) on delete cascade,
  target_user_id uuid references profiles(id) on delete cascade,
  event_type     text not null check (event_type in ('view','like','skip','unmatch','report')),
  created_at     timestamptz not null default now()
);
create index on user_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 安全
-- ---------------------------------------------------------------------------
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on blocks (blocked_id);

create table reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references profiles(id) on delete cascade,
  reported_user_id uuid not null references profiles(id) on delete cascade,
  reason           report_reason_t not null,
  detail           text,
  message_id       uuid references messages(id) on delete set null,
  status           report_status_t not null default 'open',
  handled_by       uuid references admin_users(user_id),
  admin_note       text,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index on reports (status, created_at);
create index on reports (reported_user_id);

create table verifications (
  user_id             uuid primary key references profiles(id) on delete cascade,
  status              verification_status_t not null default 'unverified',
  provider            text not null default 'stripe_identity',
  provider_session_id text,
  submitted_name      text,
  submitted_birthdate date,
  verified_name       text,
  verified_at         timestamptz,
  rejected_reason     text,
  attempt_count       int not null default 0,
  updated_at          timestamptz not null default now()
);
create trigger verifications_set_updated_at before update on verifications
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 通知・お知らせ
-- ---------------------------------------------------------------------------
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  type          notification_type_t not null,
  actor_user_id uuid references profiles(id) on delete set null,
  payload       jsonb,
  is_read       bool not null default false,
  created_at    timestamptz not null default now()
);
create index on notifications (user_id, is_read, created_at desc);

create table announcements (
  id           uuid primary key default gen_random_uuid(),
  title_ja     text not null,
  title_ko     text not null,
  body_ja      text not null,
  body_ko      text not null,
  published_at timestamptz,
  expires_at   timestamptz,
  created_by   uuid references admin_users(user_id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 課金 (Phase B)
-- ---------------------------------------------------------------------------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles(id) on delete cascade,
  plan_id                uuid references plans(id),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 subscription_status_t not null,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   bool not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on subscriptions (user_id, status);
create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references profiles(id) on delete cascade,
  subscription_id          uuid references subscriptions(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_invoice_id        text,
  amount                   int not null,
  currency                 text not null default 'jpy',
  status                   text not null,
  paid_at                  timestamptz,
  created_at               timestamptz not null default now()
);
create index on payments (user_id, created_at desc);
