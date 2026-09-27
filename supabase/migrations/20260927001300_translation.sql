-- ===========================================================================
-- 段階B: チャット翻訳 (サーバー側 Edge Function `translate` の書込経路・利用上限・AI作成文フラグ)
--
-- 方針
--   * 翻訳 API はブラウザから直接呼ばず Edge Function (service_role) 経由のみ。
--     message_translations / translation_usage への INSERT 権限は authenticated に与えない。
--   * message_translations (message_id, target_lang) を訳文キャッシュとして再利用。原文 (messages.body) は変更しない。
--   * 利用上限は app_settings.translation_limits (max_chars / per_minute / per_day) を Edge Function が参照。
--     消費実績は translation_usage に記録し、本人は自分の利用状況のみ参照できる。
--   * 送信前翻訳で AI 候補をそのまま/編集して送った場合は messages.ai_assisted = true を付け、受信側で「AI作成」表示に使う。
-- ===========================================================================

alter table messages add column if not exists ai_assisted boolean not null default false;

create table if not exists translation_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('message','draft')),
  target_lang text not null,
  chars       integer not null check (chars >= 0),
  provider    text,
  cached      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists translation_usage_user_created on translation_usage (user_id, created_at desc);

alter table translation_usage enable row level security;
create policy translation_usage_select_own on translation_usage for select to authenticated
  using (user_id = auth.uid() or is_admin());
grant select on translation_usage to authenticated;
-- INSERT は service_role (Edge Function) のみ

-- 本人の当日/直近1分の利用回数と上限 (UI の残回数表示用)
create or replace function my_translation_usage()
returns table (used_today integer, used_last_minute integer, per_day integer, per_minute integer, max_chars integer)
language sql stable security invoker set search_path = public as $$
  with lim as (
    select coalesce((select value from app_settings where key = 'translation_limits'),
                    '{"max_chars":1000,"per_minute":10,"per_day":200}'::jsonb) v
  )
  select
    (select count(*)::int from translation_usage u where u.user_id = auth.uid() and not u.cached and u.created_at >= date_trunc('day', now())),
    (select count(*)::int from translation_usage u where u.user_id = auth.uid() and not u.cached and u.created_at >= now() - interval '1 minute'),
    (select (v->>'per_day')::int from lim),
    (select (v->>'per_minute')::int from lim),
    (select (v->>'max_chars')::int from lim);
$$;
grant execute on function my_translation_usage() to authenticated;

-- 翻訳プロバイダー名 (表示・監視用。実キーは Edge Function の環境変数)
insert into app_settings (key, value) values ('translation_provider', '"auto"')
on conflict (key) do nothing;

-- サーバー側の参加者認可・上限が揃ったため自動翻訳 UI を開放 (事業者判断で false に戻せる)
update app_settings set value = 'true' where key = 'translation_auto_enabled';

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
    'pass_cooldown_days','new_member_days'
  );
$$;
