import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, resilientFetch } from '@/contexts/AuthContext';

export function usePremium() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  // user.premium はバックエンド /api/auth/me で計算済み（最も信頼性が高い）
  const evaluateFromUser = useCallback((): boolean => {
    if (!user) return false;
    if (user.premium === true) return true;
    return user.membership_type === 'premium'
      || user.membership_type === 'admin'
      || user.membership_type === 'founder_free'
      || user.is_legacy_paid === true
      || user.subscription_status === 'active';
  }, [user]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (!token) {
        setIsPremium(false);
        return false;
      }

      // まずユーザーオブジェクトから判定（/api/auth/me で計算済み）
      const fromUser = evaluateFromUser();
      if (fromUser) {
        setIsPremium(true);
        return true;
      }

      // billing API で再確認（resilientFetch で App Runner に直接フォールバック）
      const res = await resilientFetch('/api/billing/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setIsPremium(!!data?.premium);
        return !!data?.premium;
      } else {
        setIsPremium(false);
        return false;
      }
    } catch (_) {
      // API失敗時もユーザーオブジェクトから判定
      const fb = evaluateFromUser();
      setIsPremium(fb);
      return fb;
    } finally {
      setLoading(false);
    }
  }, [token, evaluateFromUser]);

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
