import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config';

export function usePremium() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  const evaluateFallback = useCallback(() => {
    return (user as any)?.premium_status === true
      || (user as any)?.membership_type === 'premium'
      || (user as any)?.membership_type === 'admin'
      || (user as any)?.is_legacy_paid === true
      || (user as any)?.subscription_status === 'active';
  }, [user]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (!token) {
        setIsPremium(false);
        return false;
      }
      const res = await fetch(`${API_URL}/api/billing/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setIsPremium(!!data?.premium);
        return !!data?.premium;
      } else {
        const fb = evaluateFallback();
        setIsPremium(fb);
        return fb;
      }
    } catch (_) {
      const fb = evaluateFallback();
      setIsPremium(fb);
      return fb;
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, evaluateFallback]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from');
      await fetchStatus();
      if (from === 'checkout') {
        // 直後に再取得して即時反映
        await fetchStatus();
        // クエリ除去（履歴は残す）
        url.searchParams.delete('from');
        window.history.replaceState({}, '', url.toString());
      }
      if (cancelled) return;
    };
    init();
    return () => { cancelled = true; };
  }, [fetchStatus]);

  const refresh = useMemo(() => fetchStatus, [fetchStatus]);

  return { loading, isPremium, refresh };
}

export function usePaidMember() {
  const { loading, isPremium, refresh } = usePremium();
  return { loading, isPaidUser: isPremium, refresh };
}
