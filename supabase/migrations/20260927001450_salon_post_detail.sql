-- 交流サロン (S1): 投稿詳細 RPC。salon_feed と同じ行形式で 1 件返す (可視性は salon_post_visible_to_me)。
create or replace function salon_post_detail(p_post uuid)
returns table (
  id uuid, author_id uuid, author_nickname text, author_nationality text, author_photo_path text,
  category_id text, title text, body text, body_lang text, photo_path text,
  comment_count int, reaction_count int, last_comment_at timestamptz, pinned_until timestamptz,
  flagged bool, is_hidden bool, deleted_at timestamptz, created_at timestamptz, reacted bool
)
language sql stable security definer set search_path = public as $$
  select sp.id, sp.author_id, p.nickname, p.nationality::text,
         (select ph.storage_path from profile_photos ph where ph.user_id = p.id order by ph.is_primary desc, ph.sort_order limit 1),
         sp.category_id, sp.title, sp.body, sp.body_lang, sp.photo_path,
         sp.comment_count, sp.reaction_count, sp.last_comment_at, sp.pinned_until,
         sp.flagged, sp.is_hidden, sp.deleted_at, sp.created_at,
         exists (select 1 from salon_reactions r where r.post_id = sp.id and r.user_id = auth.uid())
  from salon_posts sp
  join profiles p on p.id = sp.author_id
  where sp.id = p_post
    and auth.uid() is not null
    and (is_active_member() or is_admin())
    and salon_post_visible_to_me(sp.id)
$$;
grant execute on function salon_post_detail(uuid) to authenticated;
