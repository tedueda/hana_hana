import { getSupabase, PROFILE_PHOTO_BUCKET } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type {
  LanguageLevel,
  Profile,
  ProfilePhoto,
  ProfileUpdate,
  PublicProfile,
  UserLanguage,
} from '../types';

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data, error } = await getSupabase().rpc('my_profile');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateMyProfile(userId: string, patch: ProfileUpdate): Promise<void> {
  const { error } = await getSupabase().from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await getSupabase()
    .from('public_profile')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const map = new Map<string, PublicProfile>();
  if (ids.length === 0) return map;
  const { data, error } = await getSupabase().from('public_profile').select('*').in('id', ids);
  if (error) throw error;
  for (const p of data ?? []) if (p.id) map.set(p.id, p);
  return map;
}

export interface ProfileDetails {
  languages: UserLanguage[];
  interestIds: string[];
  purposeIds: string[];
  /** RLS (プランの写真閲覧上限) を通過した写真のみ */
  photos: ProfilePhoto[];
  /** 相手が登録している写真の総数 (閲覧できない分を含む) */
  photoTotal: number;
}

export async function fetchProfileDetails(userId: string): Promise<ProfileDetails> {
  const sb = getSupabase();
  const [languages, interests, purposes, photos, total] = await Promise.all([
    sb.from('user_languages').select('*').eq('user_id', userId),
    sb.from('user_interests').select('interest_id').eq('user_id', userId),
    sb.from('user_purposes').select('purpose_id').eq('user_id', userId),
    sb.from('profile_photos').select('*').eq('user_id', userId).order('sort_order'),
    sb.rpc('profile_photo_count', { p_owner: userId }),
  ]);
  const err = languages.error ?? interests.error ?? purposes.error ?? photos.error ?? total.error;
  if (err) throw err;
  const visible = photos.data ?? [];
  return {
    languages: languages.data ?? [],
    interestIds: (interests.data ?? []).map((r) => r.interest_id),
    purposeIds: (purposes.data ?? []).map((r) => r.purpose_id),
    photos: visible,
    photoTotal: Math.max(visible.length, total.data ?? 0),
  };
}

export interface LanguageInput {
  language_code: string;
  role: 'native' | 'learning';
  level: LanguageLevel;
}

export async function replaceMyLanguages(userId: string, rows: LanguageInput[]): Promise<void> {
  const sb = getSupabase();
  const del = await sb.from('user_languages').delete().eq('user_id', userId);
  if (del.error) throw del.error;
  if (rows.length === 0) return;
  const ins = await sb.from('user_languages').insert(
    rows.map((r) => ({
      user_id: userId,
      language_code: r.language_code,
      role: r.role,
      level: r.role === 'native' ? ('native' as LanguageLevel) : r.level,
    })),
  );
  if (ins.error) throw ins.error;
}

export async function replaceMyInterests(userId: string, interestIds: string[]): Promise<void> {
  const sb = getSupabase();
  const del = await sb.from('user_interests').delete().eq('user_id', userId);
  if (del.error) throw del.error;
  if (interestIds.length === 0) return;
  const ins = await sb
    .from('user_interests')
    .insert(interestIds.map((interest_id) => ({ user_id: userId, interest_id })));
  if (ins.error) throw ins.error;
}

export async function replaceMyPurposes(userId: string, purposeIds: string[]): Promise<void> {
  const sb = getSupabase();
  const del = await sb.from('user_purposes').delete().eq('user_id', userId);
  if (del.error) throw del.error;
  if (purposeIds.length === 0) return;
  const ins = await sb
    .from('user_purposes')
    .insert(purposeIds.map((purpose_id) => ({ user_id: userId, purpose_id })));
  if (ins.error) throw ins.error;
}

export async function uploadProfilePhoto(
  userId: string,
  file: File,
  sortOrder: number,
  isPrimary: boolean,
): Promise<ProfilePhoto> {
  const sb = getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from(PROFILE_PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (up.error) throw up.error;
  const ins = await sb
    .from('profile_photos')
    .insert({ user_id: userId, storage_path: path, sort_order: sortOrder, is_primary: isPrimary })
    .select('*')
    .single();
  if (ins.error) {
    await sb.storage.from(PROFILE_PHOTO_BUCKET).remove([path]);
    throw ins.error;
  }
  return ins.data;
}

export async function deleteProfilePhoto(photo: ProfilePhoto): Promise<void> {
  const sb = getSupabase();
  const del = await sb.from('profile_photos').delete().eq('id', photo.id);
  if (del.error) throw del.error;
  await sb.storage.from(PROFILE_PHOTO_BUCKET).remove([photo.storage_path]);
}

const signedUrlCache = new Map<string, { url: string; expires: number }>();

/** 非公開バケットのため署名付き URL を発行 (1時間、キャッシュあり) */
export async function photoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = signedUrlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await getSupabase()
    .storage.from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function touchLastActive(): Promise<void> {
  await getSupabase().rpc('touch_last_active');
}

export type Verification = Database['public']['Tables']['verifications']['Row'];

export const VERIFICATION_DOC_BUCKET = 'verification-docs';

export interface PublishStatus {
  photo_required: boolean;
  photo_count: number;
  photo_grace_until: string | null;
  in_grace: boolean;
  publishable: boolean;
}

export async function fetchMyPublishStatus(): Promise<PublishStatus> {
  const { data, error } = await getSupabase().rpc('my_publish_status');
  if (error) throw error;
  const r = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  return {
    photo_required: typeof r.photo_required === 'boolean' ? r.photo_required : true,
    photo_count: typeof r.photo_count === 'number' ? r.photo_count : 0,
    photo_grace_until: typeof r.photo_grace_until === 'string' ? r.photo_grace_until : null,
    in_grace: r.in_grace === true,
    publishable: r.publishable === true,
  };
}

export async function setPrimaryPhoto(userId: string, photoId: string): Promise<void> {
  const sb = getSupabase();
  const off = await sb.from('profile_photos').update({ is_primary: false }).eq('user_id', userId);
  if (off.error) throw off.error;
  const on = await sb.from('profile_photos').update({ is_primary: true }).eq('id', photoId);
  if (on.error) throw on.error;
}

export async function uploadVerificationDoc(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase().storage.from(VERIFICATION_DOC_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function requestVerification(name: string, birthdate: string, docPath: string): Promise<void> {
  const { error } = await getSupabase().rpc('request_verification', {
    p_name: name,
    p_birthdate: birthdate,
    p_doc_path: docPath,
  });
  if (error) throw error;
}

export async function verificationDocUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabase().storage.from(VERIFICATION_DOC_BUCKET).createSignedUrl(path, 600);
  return error || !data ? null : data.signedUrl;
}

export async function fetchMyVerification(): Promise<Verification | null> {
  const { data, error } = await getSupabase().from('verifications').select('*').maybeSingle();
  if (error) throw error;
  return data;
}
