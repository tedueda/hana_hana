-- STEP8 総合テストで発見: 利用停止/BAN 時に is_public=false へ落とした後、
-- 有効に戻しても非公開のままになり、相手側のマッチ一覧で「退会したユーザー」と表示されていた。
-- 有効化時は is_public を true に戻す。
create or replace function admin_set_status(p_user_id uuid, p_status account_status_t, p_reason text default null, p_until timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update profiles
     set status = p_status,
         status_reason = p_reason,
         suspended_until = case when p_status = 'suspended' then p_until else null end,
         is_public = (p_status = 'active')
   where id = p_user_id;
  if p_status in ('banned','deleted') then
    update matches set is_active = false, unmatched_at = now()
     where is_active and p_user_id in (user_low_id, user_high_id);
  end if;
  perform admin_log('set_status', 'user', p_user_id::text,
                    jsonb_build_object('status', p_status, 'reason', p_reason, 'until', p_until));
end $$;
