import { useContext } from 'react';
import { SupabaseAuthContext, type SupabaseAuthContextType } from './context';

export function useSupabaseAuth(): SupabaseAuthContextType {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
}
