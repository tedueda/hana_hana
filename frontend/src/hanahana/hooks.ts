import { errorMessage, labelsFor, type Labels } from './labels';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from './auth/useSupabaseAuth';
import { loadMasterData, localizedName, type MasterData } from './api/master';
import { fetchSentLikes, sendLike } from './api/matching';
import type { PublicProfile } from './types';

export function useLabels(): Labels {
  const { lang } = useI18n();
  return useMemo(() => labelsFor(lang), [lang]);
}

export function useErrorMessage(): (e: unknown) => string {
  const { lang } = useI18n();
  return useCallback((e: unknown) => errorMessage(e, lang), [lang]);
}

export interface NewMatch {
  peer: PublicProfile;
  conversationId: string | null;
}

export function useLikeAction() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<NewMatch | null>(null);

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
        if (res.matched) setMatched({ peer: target, conversationId: res.conversationId });
        else toast({ title: t('likes.sentToast') });
        return res;
      } catch (e) {
        toast({ title: t('likes.failed'), description: errorMessage(e, lang), variant: 'destructive' });
        return null;
      }
    },
    [user, toast, t, lang],
  );

  const dismissMatch = useCallback(() => setMatched(null), []);
  return { liked, like, matched, dismissMatch };
}

export function useRegionNames(): (id: string | null | undefined) => string | undefined {
  const { lang } = useI18n();
  const [master, setMaster] = useState<MasterData | null>(null);
  useEffect(() => {
    loadMasterData().then(setMaster).catch(() => undefined);
  }, []);
  return useCallback(
    (id) => {
      if (!id || !master) return undefined;
      return localizedName(master.regions.find((r) => r.id === id), lang) || undefined;
    },
    [master, lang],
  );
}

