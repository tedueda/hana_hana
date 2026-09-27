-- Storage: プロフィール写真バケット
-- パス規約: profile-photos/<user_id>/<uuid>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 閲覧: 所有者のプロフィールが自分に見える場合のみ
create policy "profile_photos_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and profile_visible_to_me(((storage.foldername(name))[1])::uuid)
  );

-- 追加/更新/削除: 自分のフォルダのみ
create policy "profile_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile_photos_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
