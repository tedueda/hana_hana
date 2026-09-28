-- ログイン前の料金プランページ用: 有効なプランを anon にも公開する (plans テーブル自体は authenticated のみ)
create or replace function public_plans() returns setof plans
language sql stable security definer set search_path = public as $$
  select * from plans where is_active order by sort_order;
$$;
grant execute on function public_plans() to anon, authenticated;

-- 料金ページに「お支払い失敗時の猶予日数」を表示するため公開設定に追加
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
    'plan_limits','message_rate_per_minute','search_advanced_min_tier','stripe_mode',
    'free_full_access_genders','event_price_guidance','past_due_grace_days'
  );
$$;
