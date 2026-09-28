-- ===========================================================================
-- 交流サロン (S1): テーマ・投稿・コメント・リアクション・翻訳キャッシュ・通報・運営対応・通知
--
-- 方針 (docs/monetization_salon/00_gap_analysis_and_plan.md §2.2)
--   * 無料会員も閲覧・投稿・コメント可 (is_active_member() のみ要求。プラン条件なし)
--   * 投稿は本人が編集・ソフト削除 (deleted_at)。運営は非表示 (is_hidden) / 復帰 / 削除。
--   * 一般会員には「削除済み・非表示・ブロック関係・停止中会員」の投稿/コメントを RLS で見せない。
--   * サロンから直接 DM はできない。投稿者プロフィール (/app/users/:id) → 既存いいね→相互マッチ→チャットのみ。
--   * スパム: 投稿/コメントの回数上限 (app_settings) と URL・外部連絡先の検知 (flagged=true、自動削除しない)。
--   * 運営操作は salon_moderation_actions と admin_audit_logs に理由付きで記録。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------
create table if not exists salon_categories (
  id          text primary key,
  name_ja     text not null,
  name_ko     text not null,
  description_ja text,
  description_ko text,
  icon        text,
  sort_order  int not null default 0,
  is_active   bool not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists salon_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  category_id   text not null references salon_categories(id),
  title         text not null check (char_length(title) between 1 and 80),
  body          text not null check (char_length(body) between 1 and 3000),
  body_lang     text not null default 'und' check (body_lang in ('ja','ko','en','und')),
  photo_path    text,
  is_hidden     bool not null default false,
  hidden_reason text,
  flagged       bool not null default false,
  flag_reason   text,
  pinned_until  timestamptz,
  comment_count int not null default 0,
  reaction_count int not null default 0,
  last_comment_at timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists salon_posts_feed on salon_posts (created_at desc) where deleted_at is null and not is_hidden;
create index if not exists salon_posts_category on salon_posts (category_id, created_at desc);
create index if not exists salon_posts_author on salon_posts (author_id, created_at desc);
create trigger salon_posts_updated_at before update on salon_posts for each row execute function set_updated_at();

create table if not exists salon_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references salon_posts(id) on delete cascade,
  author_id     uuid not null references profiles(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 1000),
  body_lang     text not null default 'und' check (body_lang in ('ja','ko','en','und')),
  is_hidden     bool not null default false,
  hidden_reason text,
  flagged       bool not null default false,
  flag_reason   text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists salon_comments_post on salon_comments (post_id, created_at);
create index if not exists salon_comments_author on salon_comments (author_id, created_at desc);
create trigger salon_comments_updated_at before update on salon_comments for each row execute function set_updated_at();

create table if not exists salon_reactions (
  post_id    uuid not null references salon_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 翻訳キャッシュ (Edge Function translate が service_role で書込)
create table if not exists salon_translations (
  target_type text not null check (target_type in ('post_title','post_body','comment')),
  target_id   uuid not null,
  target_lang text not null,
  translated_body text not null,
  provider    text,
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, target_lang)
);

-- 運営対応履歴
create table if not exists salon_moderation_actions (
  id          bigint generated always as identity primary key,
  admin_user_id uuid not null references admin_users(user_id),
  target_type text not null check (target_type in ('post','comment')),
  target_id   uuid not null,
  action      text not null check (action in ('hide','unhide','delete','pin','unpin','clear_flag')),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists salon_moderation_target on salon_moderation_actions (target_type, target_id, created_at desc);

-- 通報の対象拡張 (既存 reports を利用)
alter table reports add column if not exists salon_post_id uuid references salon_posts(id) on delete set null;
alter table reports add column if not exists salon_comment_id uuid references salon_comments(id) on delete set null;
create index if not exists reports_salon_post on reports (salon_post_id) where salon_post_id is not null;
create index if not exists reports_salon_comment on reports (salon_comment_id) where salon_comment_id is not null;

-- 設定 (運用中に変更可)
insert into app_settings (key, value) values
  ('salon_enabled', 'true'),
  ('salon_post_per_day', '5'),
  ('salon_comment_per_minute', '5'),
  ('salon_comment_per_day', '100'),
  ('salon_photo_enabled', 'true'),
  ('salon_hot_window_days', '7')
on conflict (key) do nothing;

-- 初期3テーマ
insert into salon_categories (id, name_ja, name_ko, description_ja, description_ko, icon, sort_order) values
  ('language_culture', 'ことば・文化', '언어·문화',
   '日本語・韓国語の表現、季節の行事、暮らしの違いなどを気軽に話す場所', '일본어·한국어 표현, 계절 행사, 생활 문화의 차이를 편하게 이야기하는 공간', '🗣️', 10),
  ('travel_food',      '旅・グルメ',   '여행·맛집',
   'おすすめの街、食べ物、旅行の相談。写真も歓迎', '추천 도시, 음식, 여행 상담. 사진도 환영합니다', '🍜', 20),
  ('free_talk',        '日韓フリートーク', '한일 프리토크',
   '日常の話、質問、はじめましての挨拶など何でも', '일상 이야기, 질문, 첫 인사 등 무엇이든', '💬', 30)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 補助関数
-- ---------------------------------------------------------------------------
create or replace function salon_setting_int(p_key text, p_default int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = p_key), p_default);
$$;

create or replace function salon_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from app_settings where key = 'salon_enabled'), true);
$$;

-- 投稿者が現在サロンに表示できる状態か (停止・退会中の会員の投稿は隠す)
create or replace function salon_author_visible(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_author and p.status = 'active' and p.deleted_at is null
  );
$$;

-- 一般会員から見て投稿が見えるか
create or replace function salon_post_visible_to_me(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from salon_posts sp
    where sp.id = p_post
      and (
        is_admin()
        or sp.author_id = auth.uid()
        or (sp.deleted_at is null and not sp.is_hidden
            and salon_author_visible(sp.author_id)
            and not is_blocked_between(auth.uid(), sp.author_id))
      )
  );
$$;

-- URL・外部連絡先誘導の簡易検知 (自動削除はせず flagged にして運営が確認)
create or replace function salon_detect_solicitation(p_text text) returns text
language plpgsql immutable as $$
declare
  t text := lower(coalesce(p_text, ''));
begin
  if t ~ '(https?://|www\.)' then return 'url'; end if;
  if t ~ '(line|ライン|라인|kakao|카카오|カカオ|instagram|インスタ|인스타|telegram|テレグラム|텔레그램|whatsapp|wechat)\s*(id|아이디|ＩＤ|:|：|→|@)' then return 'messenger_id'; end if;
  if t ~ '[0-9]{2,4}[-‐ー ]?[0-9]{3,4}[-‐ー ]?[0-9]{4}' then return 'phone'; end if;
  if t ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then return 'email'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- トリガー: 投稿・コメントの上限とフラグ、件数・通知の更新
-- ---------------------------------------------------------------------------
create or replace function salon_before_post_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit int;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    if not salon_enabled() then
      raise exception 'salon disabled' using errcode = '42501';
    end if;
    if not exists (select 1 from profiles where id = new.author_id and onboarding_completed) then
      raise exception 'onboarding required' using errcode = '42501';
    end if;
    v_limit := salon_setting_int('salon_post_per_day', 5);
    if (select count(*) from salon_posts where author_id = new.author_id and created_at >= now() - interval '1 day') >= v_limit then
      raise exception 'salon post limit' using errcode = 'P0001', hint = 'salon_post_limit';
    end if;
    if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.author_id::text then
      raise exception 'invalid photo path' using errcode = '22023';
    end if;
  end if;
  v_reason := coalesce(salon_detect_solicitation(new.title), salon_detect_solicitation(new.body));
  if v_reason is not null then
    new.flagged := true;
    new.flag_reason := v_reason;
  elsif tg_op = 'UPDATE' and (new.title <> old.title or new.body <> old.body) then
    new.flagged := false;
    new.flag_reason := null;
  end if;
  return new;
end $$;
drop trigger if exists salon_posts_before_write on salon_posts;
create trigger salon_posts_before_write before insert or update of title, body, photo_path on salon_posts
  for each row execute function salon_before_post_write();

create or replace function salon_before_comment_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reason text;
begin
  if tg_op = 'INSERT' then
    if not salon_enabled() then
      raise exception 'salon disabled' using errcode = '42501';
    end if;
    if not salon_post_visible_to_me(new.post_id) then
      raise exception 'post not available' using errcode = '42501';
    end if;
    if exists (select 1 from salon_posts where id = new.post_id and (deleted_at is not null or is_hidden)) then
      raise exception 'post closed' using errcode = '42501';
    end if;
    if (select count(*) from salon_comments where author_id = new.author_id and created_at >= now() - interval '1 minute')
         >= salon_setting_int('salon_comment_per_minute', 5) then
      raise exception 'salon comment rate' using errcode = 'P0001', hint = 'salon_comment_rate';
    end if;
    if (select count(*) from salon_comments where author_id = new.author_id and created_at >= now() - interval '1 day')
         >= salon_setting_int('salon_comment_per_day', 100) then
      raise exception 'salon comment limit' using errcode = 'P0001', hint = 'salon_comment_limit';
    end if;
  end if;
  v_reason := salon_detect_solicitation(new.body);
  if v_reason is not null then
    new.flagged := true; new.flag_reason := v_reason;
  elsif tg_op = 'UPDATE' and new.body <> old.body then
    new.flagged := false; new.flag_reason := null;
  end if;
  return new;
end $$;
drop trigger if exists salon_comments_before_write on salon_comments;
create trigger salon_comments_before_write before insert or update of body on salon_comments
  for each row execute function salon_before_comment_write();

-- コメント数・通知
create or replace function salon_after_comment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post salon_posts%rowtype;
begin
  if tg_op = 'INSERT' then
    update salon_posts set comment_count = comment_count + 1, last_comment_at = new.created_at where id = new.post_id returning * into v_post;
    if v_post.author_id <> new.author_id then
      insert into notifications (user_id, type, payload)
      values (v_post.author_id, 'salon_comment',
              jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'from_user_id', new.author_id, 'preview', left(new.body, 60)));
    end if;
  elsif tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    update salon_posts set comment_count = greatest(0, comment_count - 1) where id = new.post_id;
  elsif tg_op = 'UPDATE' and new.deleted_at is null and old.deleted_at is not null then
    update salon_posts set comment_count = comment_count + 1 where id = new.post_id;
  end if;
  return new;
end $$;
drop trigger if exists salon_comments_after_change on salon_comments;
create trigger salon_comments_after_change after insert or update of deleted_at on salon_comments
  for each row execute function salon_after_comment_change();

create or replace function salon_after_reaction_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    update salon_posts set reaction_count = reaction_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author <> new.user_id then
      insert into notifications (user_id, type, payload)
      values (v_author, 'salon_reaction', jsonb_build_object('post_id', new.post_id, 'from_user_id', new.user_id));
    end if;
    return new;
  else
    update salon_posts set reaction_count = greatest(0, reaction_count - 1) where id = old.post_id;
    return old;
  end if;
end $$;
drop trigger if exists salon_reactions_after_change on salon_reactions;
create trigger salon_reactions_after_change after insert or delete on salon_reactions
  for each row execute function salon_after_reaction_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table salon_categories enable row level security;
alter table salon_posts enable row level security;
alter table salon_comments enable row level security;
alter table salon_reactions enable row level security;
alter table salon_translations enable row level security;
alter table salon_moderation_actions enable row level security;

create policy salon_categories_select on salon_categories for select to authenticated using (is_active or is_admin());
create policy salon_categories_admin on salon_categories for all to authenticated using (is_admin()) with check (is_admin());

-- INSERT ... RETURNING で新規行を参照できるよう、関数ではなく行の列で直接判定する
create policy salon_posts_select on salon_posts for select to authenticated
  using (
    is_admin()
    or author_id = auth.uid()
    or (deleted_at is null and not is_hidden
        and salon_author_visible(author_id)
        and not is_blocked_between(auth.uid(), author_id))
  );
create policy salon_posts_insert on salon_posts for insert to authenticated
  with check (author_id = auth.uid() and is_active_member());
create policy salon_posts_update_own on salon_posts for update to authenticated
  using (author_id = auth.uid() and is_active_member()) with check (author_id = auth.uid());
-- 本人が触れる列を限定 (is_hidden/flagged/pinned は運営 RPC のみ)
revoke update on salon_posts from authenticated;
grant update (title, body, body_lang, photo_path, category_id, deleted_at) on salon_posts to authenticated;

create policy salon_comments_select on salon_comments for select to authenticated
  using (
    is_admin()
    or author_id = auth.uid()
    or (deleted_at is null and not is_hidden
        and salon_author_visible(author_id)
        and not is_blocked_between(auth.uid(), author_id)
        and salon_post_visible_to_me(post_id))
  );
create policy salon_comments_insert on salon_comments for insert to authenticated
  with check (author_id = auth.uid() and is_active_member());
create policy salon_comments_update_own on salon_comments for update to authenticated
  using (author_id = auth.uid() and is_active_member()) with check (author_id = auth.uid());
revoke update on salon_comments from authenticated;
grant update (body, body_lang, deleted_at) on salon_comments to authenticated;

create policy salon_reactions_select on salon_reactions for select to authenticated
  using (user_id = auth.uid() or is_admin() or salon_post_visible_to_me(post_id));
create policy salon_reactions_insert on salon_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_active_member() and salon_post_visible_to_me(post_id)
              and exists (select 1 from salon_posts where id = post_id and deleted_at is null and not is_hidden));
create policy salon_reactions_delete on salon_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy salon_translations_select on salon_translations for select to authenticated
  using (
    case target_type
      when 'comment' then exists (select 1 from salon_comments c where c.id = target_id)
      else salon_post_visible_to_me(target_id)
    end
  );
-- INSERT は service_role (Edge Function) のみ

create policy salon_moderation_actions_select on salon_moderation_actions for select to authenticated using (is_admin());
-- INSERT は admin RPC のみ

-- 通報: 対象が投稿/コメントの場合は reported_user_id が投稿者と一致すること
drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert to authenticated
  with check (
    reporter_id = auth.uid() and reporter_id <> reported_user_id and is_active_member()
    and (salon_post_id is null or exists (select 1 from salon_posts p where p.id = salon_post_id and p.author_id = reported_user_id))
    and (salon_comment_id is null or exists (select 1 from salon_comments c where c.id = salon_comment_id and c.author_id = reported_user_id))
  );

grant select on salon_categories, salon_posts, salon_comments, salon_reactions, salon_translations, salon_moderation_actions to authenticated;
grant insert on salon_posts, salon_comments, salon_reactions to authenticated;
grant delete on salon_reactions to authenticated;
revoke all on salon_categories, salon_posts, salon_comments, salon_reactions, salon_translations, salon_moderation_actions from anon;

-- ---------------------------------------------------------------------------
-- Storage: サロン写真 (投稿1枚)。パス: salon-photos/<user_id>/<uuid>.<ext>
-- 閲覧は認証済み会員 (投稿の可視性はアプリ側で post 経由に限定)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('salon-photos', 'salon-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "salon_photos_read" on storage.objects;
create policy "salon_photos_read" on storage.objects for select to authenticated
  using (bucket_id = 'salon-photos' and is_active_member());
drop policy if exists "salon_photos_insert" on storage.objects;
create policy "salon_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'salon-photos' and (storage.foldername(name))[1] = auth.uid()::text and is_active_member());
drop policy if exists "salon_photos_delete" on storage.objects;
create policy "salon_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'salon-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- ---------------------------------------------------------------------------
-- RPC: 会員向け
-- ---------------------------------------------------------------------------
-- フィード (kind: new | hot | replied | mine | joined)。投稿者情報を同梱 (ブロック・非表示は除外)
create or replace function salon_feed(
  p_kind text default 'new',
  p_category text default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, author_id uuid, author_nickname text, author_nationality text, author_photo_path text,
  category_id text, title text, body text, body_lang text, photo_path text,
  comment_count int, reaction_count int, last_comment_at timestamptz, pinned_until timestamptz,
  flagged bool, is_hidden bool, deleted_at timestamptz, created_at timestamptz, reacted bool
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hot_days int := salon_setting_int('salon_hot_window_days', 7);
begin
  if auth.uid() is null or not is_active_member() and not is_admin() then
    raise exception 'inactive member' using errcode = '42501';
  end if;
  return query
  select sp.id, sp.author_id, p.nickname, p.nationality::text,
         (select ph.storage_path from profile_photos ph where ph.user_id = p.id order by ph.is_primary desc, ph.sort_order limit 1),
         sp.category_id, sp.title, sp.body, sp.body_lang, sp.photo_path,
         sp.comment_count, sp.reaction_count, sp.last_comment_at, sp.pinned_until,
         sp.flagged, sp.is_hidden, sp.deleted_at, sp.created_at,
         exists (select 1 from salon_reactions r where r.post_id = sp.id and r.user_id = auth.uid())
  from salon_posts sp
  join profiles p on p.id = sp.author_id
  where salon_post_visible_to_me(sp.id)
    and (p_kind = 'mine' or (sp.deleted_at is null and not sp.is_hidden))
    and (p_category is null or sp.category_id = p_category)
    and (p_query is null or p_query = '' or sp.title ilike '%' || p_query || '%' or sp.body ilike '%' || p_query || '%')
    and case p_kind
          when 'mine'    then sp.author_id = auth.uid()
          when 'joined'  then sp.author_id = auth.uid()
                              or exists (select 1 from salon_comments c where c.post_id = sp.id and c.author_id = auth.uid() and c.deleted_at is null)
                              or exists (select 1 from salon_reactions r where r.post_id = sp.id and r.user_id = auth.uid())
          when 'replied' then sp.comment_count > 0
          when 'hot'     then sp.created_at >= now() - make_interval(days => v_hot_days)
          else true
        end
  order by
    (sp.pinned_until is not null and sp.pinned_until > now()) desc,
    case p_kind when 'hot' then sp.comment_count * 2 + sp.reaction_count else 0 end desc,
    case p_kind when 'replied' then sp.last_comment_at else sp.created_at end desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
end $$;
grant execute on function salon_feed(text, text, text, int, int) to authenticated;

-- 投稿詳細 + コメント (投稿者情報つき)
create or replace function salon_post_comments(p_post uuid)
returns table (
  id uuid, post_id uuid, author_id uuid, author_nickname text, author_nationality text, author_photo_path text,
  body text, body_lang text, flagged bool, is_hidden bool, deleted_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.post_id, c.author_id, p.nickname, p.nationality::text,
         (select ph.storage_path from profile_photos ph where ph.user_id = p.id order by ph.is_primary desc, ph.sort_order limit 1),
         c.body, c.body_lang, c.flagged, c.is_hidden, c.deleted_at, c.created_at
  from salon_comments c
  join profiles p on p.id = c.author_id
  where c.post_id = p_post
    and salon_post_visible_to_me(p_post)
    and (is_admin() or c.author_id = auth.uid()
         or (c.deleted_at is null and not c.is_hidden and salon_author_visible(c.author_id)
             and not is_blocked_between(auth.uid(), c.author_id)))
  order by c.created_at;
$$;
grant execute on function salon_post_comments(uuid) to authenticated;

-- 未読のサロン通知件数 (タブバッジ用)
create or replace function my_salon_unread() returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from notifications
  where user_id = auth.uid() and not is_read and type in ('salon_comment','salon_reaction','salon_moderation');
$$;
grant execute on function my_salon_unread() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: 運営
-- ---------------------------------------------------------------------------
create or replace function admin_salon_moderate(p_target_type text, p_target_id uuid, p_action text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_action in ('hide','delete') and coalesce(p_reason, '') = '' then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if p_target_type = 'post' then
    update salon_posts set
      is_hidden     = case p_action when 'hide' then true when 'unhide' then false else is_hidden end,
      hidden_reason = case p_action when 'hide' then p_reason when 'unhide' then null else hidden_reason end,
      deleted_at    = case p_action when 'delete' then now() else deleted_at end,
      flagged       = case p_action when 'clear_flag' then false else flagged end,
      pinned_until  = case p_action when 'pin' then now() + interval '7 days' when 'unpin' then null else pinned_until end
    where id = p_target_id returning author_id into v_author;
  elsif p_target_type = 'comment' then
    update salon_comments set
      is_hidden     = case p_action when 'hide' then true when 'unhide' then false else is_hidden end,
      hidden_reason = case p_action when 'hide' then p_reason when 'unhide' then null else hidden_reason end,
      deleted_at    = case p_action when 'delete' then now() else deleted_at end,
      flagged       = case p_action when 'clear_flag' then false else flagged end
    where id = p_target_id returning author_id into v_author;
  else
    raise exception 'invalid target' using errcode = '22023';
  end if;
  if v_author is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into salon_moderation_actions (admin_user_id, target_type, target_id, action, reason)
  values (auth.uid(), p_target_type, p_target_id, p_action, p_reason);
  perform admin_log('salon_' || p_action, 'salon_' || p_target_type, p_target_id::text, jsonb_build_object('reason', p_reason));
  if p_action in ('hide','delete') then
    insert into notifications (user_id, type, payload)
    values (v_author, 'salon_moderation', jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id, 'action', p_action, 'reason', p_reason));
  end if;
end $$;
grant execute on function admin_salon_moderate(text, uuid, text, text) to authenticated;

-- 運営用一覧 (通報件数つき)
create or replace function admin_salon_posts(p_filter text default 'all', p_category text default null, p_size int default 50, p_offset int default 0)
returns table (
  id uuid, author_id uuid, author_nickname text, category_id text, title text, body text, photo_path text,
  is_hidden bool, hidden_reason text, flagged bool, flag_reason text, deleted_at timestamptz, pinned_until timestamptz,
  comment_count int, reaction_count int, report_count bigint, open_report_count bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select sp.id, sp.author_id, p.nickname, sp.category_id, sp.title, sp.body, sp.photo_path,
         sp.is_hidden, sp.hidden_reason, sp.flagged, sp.flag_reason, sp.deleted_at, sp.pinned_until,
         sp.comment_count, sp.reaction_count,
         (select count(*) from reports r where r.salon_post_id = sp.id),
         (select count(*) from reports r where r.salon_post_id = sp.id and r.status in ('open','in_review')),
         sp.created_at
  from salon_posts sp join profiles p on p.id = sp.author_id
  where (p_category is null or sp.category_id = p_category)
    and case p_filter
          when 'reported' then exists (select 1 from reports r where r.salon_post_id = sp.id and r.status in ('open','in_review'))
          when 'flagged'  then sp.flagged
          when 'hidden'   then sp.is_hidden
          when 'deleted'  then sp.deleted_at is not null
          else true end
  order by sp.created_at desc
  limit greatest(1, least(p_size, 200)) offset greatest(0, p_offset);
end $$;
grant execute on function admin_salon_posts(text, text, int, int) to authenticated;

create or replace function admin_salon_comments(p_filter text default 'all', p_post uuid default null, p_size int default 50, p_offset int default 0)
returns table (
  id uuid, post_id uuid, post_title text, author_id uuid, author_nickname text, body text,
  is_hidden bool, hidden_reason text, flagged bool, flag_reason text, deleted_at timestamptz,
  report_count bigint, open_report_count bigint, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select c.id, c.post_id, sp.title, c.author_id, p.nickname, c.body,
         c.is_hidden, c.hidden_reason, c.flagged, c.flag_reason, c.deleted_at,
         (select count(*) from reports r where r.salon_comment_id = c.id),
         (select count(*) from reports r where r.salon_comment_id = c.id and r.status in ('open','in_review')),
         c.created_at
  from salon_comments c join salon_posts sp on sp.id = c.post_id join profiles p on p.id = c.author_id
  where (p_post is null or c.post_id = p_post)
    and case p_filter
          when 'reported' then exists (select 1 from reports r where r.salon_comment_id = c.id and r.status in ('open','in_review'))
          when 'flagged'  then c.flagged
          when 'hidden'   then c.is_hidden
          when 'deleted'  then c.deleted_at is not null
          else true end
  order by c.created_at desc
  limit greatest(1, least(p_size, 200)) offset greatest(0, p_offset);
end $$;
grant execute on function admin_salon_comments(text, uuid, int, int) to authenticated;

-- 指標: 週次投稿者 (JP/KR)、48h 返信率、通報件数
create or replace function admin_salon_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select jsonb_build_object(
    'posts_total', (select count(*) from salon_posts where deleted_at is null),
    'posts_7d', (select count(*) from salon_posts where deleted_at is null and created_at >= now() - interval '7 days'),
    'comments_7d', (select count(*) from salon_comments where deleted_at is null and created_at >= now() - interval '7 days'),
    'posters_7d_jp', (select count(distinct sp.author_id) from salon_posts sp join profiles p on p.id = sp.author_id
                      where sp.created_at >= now() - interval '7 days' and p.nationality = 'JP'),
    'posters_7d_kr', (select count(distinct sp.author_id) from salon_posts sp join profiles p on p.id = sp.author_id
                      where sp.created_at >= now() - interval '7 days' and p.nationality = 'KR'),
    'reply_rate_48h', (select case when count(*) = 0 then null else
                         round(100.0 * count(*) filter (where exists (
                           select 1 from salon_comments c where c.post_id = sp.id and c.author_id <> sp.author_id
                             and c.created_at <= sp.created_at + interval '48 hours')) / count(*), 1) end
                       from salon_posts sp where sp.deleted_at is null and sp.created_at between now() - interval '30 days' and now() - interval '48 hours'),
    'reports_open', (select count(*) from reports where status in ('open','in_review') and (salon_post_id is not null or salon_comment_id is not null)),
    'flagged', (select count(*) from salon_posts where flagged and deleted_at is null) + (select count(*) from salon_comments where flagged and deleted_at is null),
    'hidden', (select count(*) from salon_posts where is_hidden) + (select count(*) from salon_comments where is_hidden)
  ) into v;
  return v;
end $$;
grant execute on function admin_salon_stats() to authenticated;

-- 既存 admin_list_reports に対象種別を含めるための補助 view は不要 (reports に列追加済み)。
-- 翻訳 Edge Function 用の利用種別を拡張
alter table translation_usage drop constraint if exists translation_usage_kind_check;
alter table translation_usage add constraint translation_usage_kind_check
  check (kind in ('message','draft','salon_post','salon_comment'));

-- 公開設定にサロン関連を追加
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
    'salon_enabled','salon_post_per_day','salon_comment_per_minute','salon_comment_per_day','salon_photo_enabled'
  );
$$;
