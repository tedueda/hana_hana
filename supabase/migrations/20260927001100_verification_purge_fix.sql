-- admin_purge_verification_docs: Supabase Storage の直接削除保護 (storage.protect_delete) に対応。
-- 関数内でのみ storage.allow_delete_query を有効化して書類オブジェクトを削除する。
create or replace function admin_purge_verification_docs() returns int
language plpgsql security definer set search_path = public as $$
declare v_days int; v_count int;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_days := coalesce((select (value #>> '{}')::int from app_settings where key = 'verification_doc_retention_days'), 90);
  perform set_config('storage.allow_delete_query', 'true', true);
  with target as (
    select user_id, doc_path from verifications
    where doc_path is not null and status in ('verified', 'rejected')
      and updated_at < now() - make_interval(days => v_days)
  ), del as (
    delete from storage.objects o using target t
    where o.bucket_id = 'verification-docs' and o.name = t.doc_path
    returning o.name
  )
  update verifications v set doc_path = null from target t where v.user_id = t.user_id;
  get diagnostics v_count = row_count;
  perform set_config('storage.allow_delete_query', 'false', true);
  perform admin_log('purge_verification_docs', 'system', null, jsonb_build_object('count', v_count));
  return v_count;
end $$;
grant execute on function admin_purge_verification_docs() to authenticated;
