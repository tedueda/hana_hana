import { getSupabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/supabase';
import type { Interest, Language, Purpose, Region } from '../types';

type Fn = Database['public']['Functions'];
type Enums = Database['public']['Enums'];

export type AccountStatus = Enums['account_status_t'];
export type ReportStatus = Enums['report_status_t'];
export type VerificationStatus = Enums['verification_status_t'];
export type AdminRole = Enums['admin_role_t'];
export type AdminUserRow = Fn['admin_list_users']['Returns'][number];
export type AdminReportRow = Fn['admin_list_reports']['Returns'][number];
export type AdminAdminRow = Fn['admin_list_admins']['Returns'][number];
export type Announcement = Database['public']['Tables']['announcements']['Row'];
export type AnnouncementInsert = Database['public']['Tables']['announcements']['Insert'];

export interface AdminStats {
  users_total: number;
  users_active: number;
  users_suspended: number;
  users_banned: number;
  users_jp: number;
  users_kr: number;
  users_paid: number;
  users_new_7d: number;
  active_24h: number;
  likes_total: number;
  matches_active: number;
  matches_total: number;
  messages_total: number;
  messages_24h: number;
  reports_open: number;
  verifications_pending: number;
}

export async function fetchAdminRole(): Promise<AdminRole | null> {
  const { data, error } = await getSupabase().rpc('admin_role');
  if (error) throw error;
  return data ?? null;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await getSupabase().rpc('admin_stats');
  if (error) throw error;
  return data as unknown as AdminStats;
}

export interface UserListParams {
  query?: string;
  status?: AccountStatus;
  nationality?: Enums['nationality_t'];
  verification?: VerificationStatus;
  page?: number;
  size?: number;
}

export async function listUsers(p: UserListParams): Promise<{ rows: AdminUserRow[]; total: number }> {
  const { data, error } = await getSupabase().rpc('admin_list_users', {
    p_query: p.query || undefined,
    p_status: p.status,
    p_nationality: p.nationality,
    p_verification: p.verification,
    p_page: p.page ?? 1,
    p_size: p.size ?? 30,
  });
  if (error) throw error;
  return { rows: data ?? [], total: Number(data?.[0]?.total_count ?? 0) };
}

export interface AdminUserDetail {
  profile: Database['public']['Tables']['profiles']['Row'];
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  verification: Database['public']['Tables']['verifications']['Row'] | null;
  languages: Database['public']['Tables']['user_languages']['Row'][];
  purposes: string[];
  interests: string[];
  photos: Database['public']['Tables']['profile_photos']['Row'][];
  stats: Record<string, number>;
  audit: Database['public']['Tables']['admin_audit_logs']['Row'][];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { data, error } = await getSupabase().rpc('admin_get_user', { p_user_id: userId });
  if (error) throw error;
  return (data as unknown as AdminUserDetail | null) ?? null;
}

export async function setUserStatus(userId: string, status: AccountStatus, reason?: string, until?: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_status', {
    p_user_id: userId,
    p_status: status,
    p_reason: reason,
    p_until: until,
  });
  if (error) throw error;
}

export async function setVerification(userId: string, status: VerificationStatus, reason?: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_verification', { p_user_id: userId, p_status: status, p_reason: reason });
  if (error) throw error;
}

export async function listReports(status?: ReportStatus, page = 1, size = 30): Promise<{ rows: AdminReportRow[]; total: number }> {
  const { data, error } = await getSupabase().rpc('admin_list_reports', { p_status: status, p_page: page, p_size: size });
  if (error) throw error;
  return { rows: data ?? [], total: Number(data?.[0]?.total_count ?? 0) };
}

export async function resolveReport(reportId: string, status: ReportStatus, note?: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_resolve_report', { p_report_id: reportId, p_status: status, p_note: note });
  if (error) throw error;
}

export async function listAdmins(): Promise<AdminAdminRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_admins');
  if (error) throw error;
  return data ?? [];
}

export async function upsertAdmin(email: string, role: AdminRole): Promise<void> {
  const { error } = await getSupabase().rpc('admin_upsert_admin', { p_email: email, p_role: role });
  if (error) throw error;
}

export async function removeAdmin(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_remove_admin', { p_user_id: userId });
  if (error) throw error;
}

export type MasterTable = 'interests' | 'purposes' | 'languages' | 'regions';

export interface MasterRow {
  key: string;
  code: string;
  name_ja: string;
  name_ko: string;
  name_en: string;
  sort_order: number;
  is_active: boolean;
  category: string | null;
  country: Enums['country_t'] | null;
}

const toRow = (r: Interest | Purpose | Language | Region, key: string, code: string, category: string | null, country: Enums['country_t'] | null): MasterRow => ({
  key,
  code,
  name_ja: r.name_ja,
  name_ko: r.name_ko,
  name_en: r.name_en,
  sort_order: r.sort_order,
  is_active: r.is_active,
  category,
  country,
});

export async function listMaster(table: MasterTable): Promise<MasterRow[]> {
  const sb = getSupabase();
  if (table === 'languages') {
    const { data, error } = await sb.from('languages').select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []).map((r) => toRow(r, r.code, r.code, null, null));
  }
  if (table === 'regions') {
    const { data, error } = await sb.from('regions').select('*').order('country').order('sort_order');
    if (error) throw error;
    return (data ?? []).map((r) => toRow(r, r.id, r.code, null, r.country));
  }
  if (table === 'interests') {
    const { data, error } = await sb.from('interests').select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []).map((r) => toRow(r, r.id, r.slug, r.category, null));
  }
  const { data, error } = await sb.from('purposes').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []).map((r) => toRow(r, r.id, r.slug, null, null));
}

export type MasterInput = Omit<MasterRow, 'key'>;

export async function saveMaster(table: MasterTable, key: string | null, input: MasterInput): Promise<void> {
  const sb = getSupabase();
  const base = { name_ja: input.name_ja, name_ko: input.name_ko, name_en: input.name_en, sort_order: input.sort_order, is_active: input.is_active };
  let error: { message: string } | null;
  if (table === 'languages') {
    const row = { ...base, code: input.code };
    ({ error } = key ? await sb.from('languages').update(row).eq('code', key) : await sb.from('languages').insert(row));
  } else if (table === 'regions') {
    const row = { ...base, code: input.code, country: input.country ?? 'JP' };
    ({ error } = key ? await sb.from('regions').update(row).eq('id', key) : await sb.from('regions').insert(row));
  } else if (table === 'interests') {
    const row = { ...base, slug: input.code, category: input.category };
    ({ error } = key ? await sb.from('interests').update(row).eq('id', key) : await sb.from('interests').insert(row));
  } else {
    const row = { ...base, slug: input.code };
    ({ error } = key ? await sb.from('purposes').update(row).eq('id', key) : await sb.from('purposes').insert(row));
  }
  if (error) throw error;
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await getSupabase().from('announcements').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveAnnouncement(id: string | null, input: AnnouncementInsert): Promise<void> {
  const sb = getSupabase();
  const { error } = id ? await sb.from('announcements').update(input).eq('id', id) : await sb.from('announcements').insert(input);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await getSupabase().from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAuditLogs(limit = 100): Promise<Database['public']['Tables']['admin_audit_logs']['Row'][]> {
  const { data, error } = await getSupabase().from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export const jsonText = (j: Json | null): string => (j == null ? '' : typeof j === 'string' ? j : JSON.stringify(j));
