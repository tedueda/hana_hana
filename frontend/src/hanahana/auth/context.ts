import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UiLang } from '../types';

export interface SignUpConsent {
  terms_version: string;
  privacy_version: string;
  min_age: number;
  consented_at: string;
}

export interface SupabaseAuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signUp: (
    email: string,
    password: string,
    nickname: string,
    uiLang: UiLang,
    consent?: SignUpConsent,
  ) => Promise<{ needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

export const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

