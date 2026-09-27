import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from './auth/useSupabaseAuth';
import { loadMasterData, localizedName, type MasterData } from './api/master';
import { fetchSentLikes, sendLike } from './api/matching';
import type { PublicProfile, UiLang } from './types';

export function useLikeAction() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchSentLikes(user.id).then((ls) => setLiked(new Set(ls.map((l) => l.to_user_id)))).catch(() => undefined);
  }, [user]);

  const like = useCallback(
    async (target: PublicProfile) => {
      if (!user || !target.id) return;
      try {
        const res = await sendLike(user.id, target.id);
        setLiked((prev) => new Set(prev).add(target.id!));
        toast(
          res.matched
            ? { title: 'マッチ成立！', description: `${target.nickname ?? ''} さんとメッセージを始められます` }
            : { title: 'いいねを送りました' },
        );
      } catch (e) {
        toast({ title: 'いいねできませんでした', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
      }
    },
    [user, toast],
  );

  return { liked, like };
}

export function useRegionNames(): (id: string | null | undefined) => string | undefined {
  const { profile } = useSupabaseAuth();
  const [master, setMaster] = useState<MasterData | null>(null);
  useEffect(() => {
    loadMasterData().then(setMaster).catch(() => undefined);
  }, []);
  const lang = (profile?.preferred_ui_lang ?? 'ja') as UiLang;
  return useCallback(
    (id) => {
      if (!id || !master) return undefined;
      return localizedName(master.regions.find((r) => r.id === id), lang) || undefined;
    },
    [master, lang],
  );
}

