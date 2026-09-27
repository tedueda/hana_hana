import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { fetchMyProfile, touchLastActive } from '../api/profile';
import type { Profile } from '../types';
import { SupabaseAuthContext, type SupabaseAuthContextType } from './context';

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await fetchMyProfile();
      setProfile(p);
      return p;
    } catch (e) {
      console.error('failed to load profile', e);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    let active = true;

    sb.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        await refreshProfile();
        void touchLastActive();
      }
      setIsLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        // supabase-js のコールバック内で await すると deadlock するため非同期に逃がす
        setTimeout(() => void refreshProfile(), 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const value = useMemo<SupabaseAuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      refreshProfile,
      signUp: async (email, password, nickname, uiLang) => {
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          options: {
            data: { nickname, ui_lang: uiLang },
            emailRedirectTo: `${window.location.origin}/app/login`,
          },
        });
        if (error) throw error;
        return { needsEmailConfirm: !data.session };
      },
      signIn: async (email, password) => {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await getSupabase().auth.signOut();
        if (error) throw error;
      },
      requestPasswordReset: async (email) => {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/app/reset-password`,
        });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) throw error;
      },
    }),
    [session, profile, isLoading, refreshProfile],
  );

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
};
