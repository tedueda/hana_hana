-- ===========================================================================
-- UI/UX 改修 段階A-2: 段階式オンボーディング / 写真必須 / 本人確認申請
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 生年月日のサーバー側検証 (min_age 未満・未来日付を拒否)
-- ---------------------------------------------------------------------------
create or replace function min_age() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = 'min_age'), 18);
$$;

create or replace function validate_profile_birthdate() returns trigger
language plpgsql as $$
begin
  if new.birthdate is not null then
    if new.birthdate > current_date then
      raise exception 'birthdate must not be in the future' using errcode = '23514';
    end if;
    if new.birthdate > (current_date - make_interval(years => min_age())) then
      raise exception 'must be at least % years old', min_age() using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_validate_birthdate on profiles;
create trigger profiles_validate_birthdate
  before insert or update of birthdate on profiles
  for each row execute function validate_profile_birthdate();

-- ---------------------------------------------------------------------------
-- 写真必須 (photo_required) と既存会員の猶予 (photo_grace_until)
--   猶予対象: photo_grace_start より前に作成された会員。猶予期限までは写真なしでも公開。
-- ---------------------------------------------------------------------------
insert into app_settings (key, value) values ('photo_grace_start', to_jsonb(now()::date::text))
on conflict (key) do nothing;

create or replace function has_publishable_photo(p_user_id uuid, p_created_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select not coalesce((select (value #>> '{}')::bool from app_settings where key = 'photo_required'), true)
      or exists (select 1 from profile_photos ph where ph.user_id = p_user_id)
      or (
        p_created_at < coalesce((select (value #>> '{}')::date from app_settings where key = 'photo_grace_start'), current_date)
        and current_date <= coalesce((select (value #>> '{}')::date from app_settings where key = 'photo_grace_until'), current_date)
      );
$$;

create or replace function profile_visible_to_me(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = auth.uid()
      or is_admin()
      or exists (
        select 1 from profiles p
        where p.id = target
          and p.is_public and p.onboarding_completed
          and p.status = 'active' and p.deleted_at is null
          and has_publishable_photo(p.id, p.created_at)
          and not is_blocked_between(auth.uid(), target)
      );
$$;

create or replace function candidate_profiles()
returns setof profiles
language sql stable security definer set search_path = public as $$
  select p.* from profiles p
  where p.id <> auth.uid()
    and p.is_public and p.onboarding_completed
    and p.status = 'active' and p.deleted_at is null
    and has_publishable_photo(p.id, p.created_at)
    and not is_blocked_between(auth.uid(), p.id);
$$;

-- 本人向け: 公開状態と不足項目
create or replace function my_publish_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'photo_required',    coalesce((select (value #>> '{}')::bool from app_settings where key = 'photo_required'), true),
    'photo_count',       (select count(*) from profile_photos where user_id = auth.uid()),
    'photo_grace_until', (select value #>> '{}' from app_settings where key = 'photo_grace_until'),
    'in_grace',          (select p.created_at < coalesce((select (value #>> '{}')::date from app_settings where key = 'photo_grace_start'), current_date)
                              and current_date <= coalesce((select (value #>> '{}')::date from app_settings where key = 'photo_grace_until'), current_date)
                          from profiles p where p.id = auth.uid()),
    'publishable',       (select has_publishable_photo(p.id, p.created_at) and p.onboarding_completed and p.is_public
                          from profiles p where p.id = auth.uid())
  );
$$;
grant execute on function my_publish_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 本人確認申請 (手動審査): 書類は非公開バケット verification-docs (本人 upload / admin read)
-- ---------------------------------------------------------------------------
alter table verifications alter column provider set default 'manual';
alter table verifications add column if not exists doc_path text;
alter table verifications add column if not exists submitted_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "verification_docs_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification_docs_read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy "verification_docs_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- 申請: unverified / rejected からのみ。pending / verified 中は拒否。
create or replace function request_verification(p_name text, p_birthdate date, p_doc_path text) returns void
language plpgsql security definer set search_path = public as $$
declare v_status verification_status_t;
begin
  if not is_active_member() then
    raise exception 'not an active member' using errcode = '42501';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required' using errcode = '23514';
  end if;
  if p_doc_path is null or split_part(p_doc_path, '/', 1) <> auth.uid()::text
     or not exists (select 1 from storage.objects where bucket_id = 'verification-docs' and name = p_doc_path) then
    raise exception 'document not uploaded' using errcode = '23514';
  end if;

  select status into v_status from verifications where user_id = auth.uid();
  if v_status in ('pending', 'verified') then
    raise exception 'verification already %', v_status using errcode = '23505';
  end if;

  update verifications set
    status              = 'pending',
    provider            = 'manual',
    submitted_name      = left(trim(p_name), 100),
    submitted_birthdate = p_birthdate,
    doc_path            = p_doc_path,
    submitted_at        = now(),
    rejected_reason     = null,
    attempt_count       = attempt_count + 1
  where user_id = auth.uid();
  if not found then
    insert into verifications (user_id, status, provider, submitted_name, submitted_birthdate, doc_path, submitted_at, attempt_count)
    values (auth.uid(), 'pending', 'manual', left(trim(p_name), 100), p_birthdate, p_doc_path, now(), 1);
  end if;
end $$;
grant execute on function request_verification(text, date, text) to authenticated;

-- 審査確定後、保持期限 (verification_doc_retention_days) を過ぎた書類を削除 (運営が定期実行)
create or replace function admin_purge_verification_docs() returns int
language plpgsql security definer set search_path = public as $$
declare v_days int; v_count int;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_days := coalesce((select (value #>> '{}')::int from app_settings where key = 'verification_doc_retention_days'), 90);
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
  perform admin_log('purge_verification_docs', 'system', null, jsonb_build_object('count', v_count));
  return v_count;
end $$;
grant execute on function admin_purge_verification_docs() to authenticated;

-- ---------------------------------------------------------------------------
-- public_settings: 本人確認書類の保持日数を公開 (申請画面の説明文に使用)
-- ---------------------------------------------------------------------------
create or replace function public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_settings
  where key in (
    'terms_version','privacy_version','min_age','photo_required','photo_grace_until',
    'verification_provider','verification_doc_retention_days',
    'translation_enabled','translation_auto_enabled','translation_limits',
    'require_verification_for_like','max_profile_photos','account_purge_days'
  );
$$;
