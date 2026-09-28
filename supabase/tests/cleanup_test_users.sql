-- 実行: SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/cleanup_test_users.sql
-- 開発用のダミー会員 (@hanahana.test) を管理者アカウントを除いて全削除する。
-- 会員に紐づく profiles / likes / matches / messages / salon 投稿 / 購読 などは FK cascade で削除される。
-- 本番の実会員には触れない (メールドメイン @hanahana.test のみ対象)。
-- Storage 上の写真は SQL から削除できないため scripts/cleanup_test_storage.py で削除する。
do $$
declare
  victims uuid[];
begin
  select coalesce(array_agg(u.id), '{}') into victims
  from auth.users u
  where u.email like '%@hanahana.test'
    and not exists (select 1 from admin_users a where a.user_id = u.id);

  update matches set unmatched_by = null where unmatched_by = any(victims);
  delete from auth.users where id = any(victims);
  raise notice 'deleted % test users', coalesce(array_length(victims, 1), 0);
end $$;
select u.email, p.nickname from auth.users u left join profiles p on p.id = u.id order by u.created_at;
