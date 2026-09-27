-- UI/UX 改修 段階A-1: 規約同意の記録・利用者設定・事業者が変更可能な設定キー
-- 既存テーブルは変更せず追加のみ (profiles.onboarding_step は列追加)

-- ---------------------------------------------------------------------------
-- app_settings: 事業者判断が必要な未決事項を設定キーとして予約 (既定値付き)
-- ---------------------------------------------------------------------------
insert into app_settings (key, value) values
  ('terms_version',            '"2026-09-27"'),
  ('privacy_version',          '"2026-09-27"'),
  ('min_age',                  '18'),
  ('photo_required',           'true'),
  ('photo_grace_until',        '"2026-10-27"'),
  ('verification_provider',    '"manual"'),
  ('verification_doc_retention_days', '90'),
  ('translation_enabled',      'true'),
  ('translation_auto_enabled', 'false'),
  ('translation_limits',       '{"max_chars":1000,"per_minute":10,"per_day":200}'),
  ('recommend_skip_hours',     '24'),
  ('account_purge_days',       '30')
on conflict (key) do nothing;

-- 利用者に公開してよい設定キーだけを返す (RLS は admin のみのため RPC で限定公開)
create or replace function public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_settings
  where key in (
    'terms_version','privacy_version','min_age','photo_required','photo_grace_until',
    'verification_provider','translation_enabled','translation_auto_enabled','translation_limits',
    'require_verification_for_like','max_profile_photos','account_purge_days'
  );
$$;
grant execute on function public_settings() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles.onboarding_step: 段階式オンボーディングの復帰位置 (0..7, 完了は onboarding_completed)
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists onboarding_step int not null default 0
  check (onboarding_step between 0 and 8);
grant update (onboarding_step) on profiles to authenticated;
grant select (onboarding_step) on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- user_consents: 同意した規約の版と日時 (追記のみ、削除不可)
-- ---------------------------------------------------------------------------
create table if not exists user_consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('terms','privacy','age')),
  version     text not null,
  ui_lang     text,
  agreed_at   timestamptz not null default now()
);
create index if not exists user_consents_user_idx on user_consents (user_id, kind, agreed_at desc);
alter table user_consents enable row level security;
create policy user_consents_select on user_consents for select to authenticated
  using (user_id = auth.uid() or is_admin());
-- 書き込みは record_consent() 経由のみ
revoke all on user_consents from anon, authenticated;
grant select on user_consents to authenticated;

create or replace function record_consent(p_kinds text[], p_ui_lang text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text;
  v text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  foreach k in array p_kinds loop
    v := case k
      when 'terms'   then (select value #>> '{}' from app_settings where key = 'terms_version')
      when 'privacy' then (select value #>> '{}' from app_settings where key = 'privacy_version')
      when 'age'     then (select value #>> '{}' from app_settings where key = 'min_age')
      else null end;
    if v is null then
      raise exception 'unknown consent kind %', k using errcode = '22023';
    end if;
    insert into user_consents (user_id, kind, version, ui_lang) values (auth.uid(), k, v, p_ui_lang);
  end loop;
end $$;
grant execute on function record_consent(text[], text) to authenticated;

-- 最新の同意状況 (現行版に同意済みか) を返す
create or replace function my_consent_status()
returns table (kind text, version text, agreed_at timestamptz, is_current boolean)
language sql stable security definer set search_path = public as $$
  with cur as (
    select 'terms' as kind, value #>> '{}' as version from app_settings where key = 'terms_version'
    union all
    select 'privacy', value #>> '{}' from app_settings where key = 'privacy_version'
    union all
    select 'age', value #>> '{}' from app_settings where key = 'min_age'
  ),
  latest as (
    select distinct on (c.kind) c.kind, c.version, c.agreed_at
    from user_consents c where c.user_id = auth.uid()
    order by c.kind, c.agreed_at desc
  )
  select cur.kind, latest.version, latest.agreed_at, (latest.version = cur.version) as is_current
  from cur left join latest on latest.kind = cur.kind;
$$;
grant execute on function my_consent_status() to authenticated;

-- ---------------------------------------------------------------------------
-- user_settings: 翻訳・通知などの利用者設定 (複数端末で同期)
-- ---------------------------------------------------------------------------
create table if not exists user_settings (
  user_id               uuid primary key references profiles(id) on delete cascade,
  auto_translate        bool not null default false,
  translate_target_lang text references languages(code),
  notify_like           bool not null default true,
  notify_match          bool not null default true,
  notify_message        bool not null default true,
  notify_email          bool not null default true,
  updated_at            timestamptz not null default now()
);
alter table user_settings enable row level security;
create policy user_settings_select on user_settings for select to authenticated
  using (user_id = auth.uid());
create policy user_settings_insert on user_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy user_settings_update on user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on user_settings to authenticated;

create or replace function user_settings_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists user_settings_touch on user_settings;
create trigger user_settings_touch before update on user_settings
  for each row execute function user_settings_touch();

-- ---------------------------------------------------------------------------
-- ブロック一覧 (相手の表示名・主写真を含む) — blocks は blocker 本人のみ SELECT 可のため、
-- 相手プロフィールは public_profile では非表示になる (ブロック関係で不可視) ので RPC で最小情報を返す
-- ---------------------------------------------------------------------------
create or replace function my_blocks()
returns table (blocked_id uuid, nickname text, primary_photo_path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, p.nickname,
         (select ph.storage_path from profile_photos ph where ph.user_id = p.id
            order by ph.is_primary desc, ph.sort_order limit 1),
         b.created_at
  from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
grant execute on function my_blocks() to authenticated;

-- ---------------------------------------------------------------------------
-- 会話一覧 (/app/chats): 相手・最終メッセージ・未読件数を1回で取得
-- ---------------------------------------------------------------------------
create or replace function my_conversations()
returns table (
  conversation_id uuid, match_id uuid, is_active boolean,
  peer_id uuid, peer_nickname text, peer_photo_path text,
  last_message_at timestamptz, last_message_preview text, unread_count int
)
language sql stable security definer set search_path = public as $$
  select c.id, m.id, m.is_active,
         case when m.user_low_id = auth.uid() then m.user_high_id else m.user_low_id end as peer_id,
         p.nickname,
         (select ph.storage_path from profile_photos ph where ph.user_id = p.id
            order by ph.is_primary desc, ph.sort_order limit 1),
         c.last_message_at, c.last_message_preview,
         (select count(*)::int from messages ms
           where ms.conversation_id = c.id and ms.sender_id <> auth.uid()
             and ms.read_at is null and ms.deleted_at is null)
  from conversations c
  join matches m on m.id = c.match_id
  join profiles p on p.id = case when m.user_low_id = auth.uid() then m.user_high_id else m.user_low_id end
  where auth.uid() in (m.user_low_id, m.user_high_id)
  order by coalesce(c.last_message_at, m.matched_at) desc;
$$;
grant execute on function my_conversations() to authenticated;
