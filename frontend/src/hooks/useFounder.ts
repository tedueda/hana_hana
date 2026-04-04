import { useCallback, useEffect, useState } from 'react';
import { resilientFetch } from '@/contexts/AuthContext';

interface FounderStatus {
  total_founders: number;
  remaining_slots: number;
  limit: number;
  is_accepting: boolean;
}

export function useFounderStatus() {
  const [status, setStatus] = useState<FounderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resilientFetch('/api/founder/status');
      if (res.ok) {
        const data: FounderStatus = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch founder status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refresh: fetchStatus };
}

interface ReferralStats {
  ref_code: string;
  total_referrals: number;
  paid_referrals: number;
}

export function useReferralStats(token: string | null) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await resilientFetch('/api/founder/referral-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ReferralStats = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.warn('Failed to fetch referral stats:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
