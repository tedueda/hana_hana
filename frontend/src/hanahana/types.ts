import type { Database } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type Profile = Tables['profiles']['Row'];
export type ProfileUpdate = Tables['profiles']['Update'];
export type PublicProfile = Database['public']['Views']['public_profile']['Row'];
export type ProfilePhoto = Tables['profile_photos']['Row'];
export type Language = Tables['languages']['Row'];
export type Interest = Tables['interests']['Row'];
export type Purpose = Tables['purposes']['Row'];
export type Region = Tables['regions']['Row'];
export type UserLanguage = Tables['user_languages']['Row'];
export type Like = Tables['likes']['Row'];
export type Match = Tables['matches']['Row'];
export type Conversation = Tables['conversations']['Row'];
export type Message = Tables['messages']['Row'];
export type Notification = Tables['notifications']['Row'];

export type Gender = Enums['gender_t'];
export type Nationality = Enums['nationality_t'];
export type Country = Enums['country_t'];
export type LanguageLevel = Enums['language_level_t'];
export type LanguageRole = Enums['language_role_t'];
export type MeetingPref = Enums['meeting_pref_t'];
export type ReportReason = Enums['report_reason_t'];

export type UiLang = 'ja' | 'ko' | 'en';

export interface RecommendedUser {
  id: string;
  score: number;
  reasons: string[];
  profile: PublicProfile;
}

export interface MatchWithPeer {
  match: Match;
  conversation: Conversation | null;
  peer: PublicProfile | null;
}

export interface SearchFilters {
  nationality?: Nationality;
  residence_country?: Country;
  residence_region_id?: string;
  gender?: Gender;
  age_min?: number;
  age_max?: number;
  purposes?: string[];
  interests?: string[];
  native_language?: string;
  learning_language?: string;
  learning_level?: LanguageLevel;
  meeting_pref?: MeetingPref;
  verified_only?: boolean;
  joined_within_days?: number;
  sort?: 'active' | 'new';
}
