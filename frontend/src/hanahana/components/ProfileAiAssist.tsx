import React, { useEffect, useState } from 'react';
import { Languages, Sparkles, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchMyPlanFeatures } from '../api/premium';
import { polishProfile, translateProfile, TranslateError } from '../api/translation';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';
import PremiumLock from './PremiumLock';

/**
 * 自己紹介の AI 添削 / 翻訳補助 (プレミアム)。
 * 提案はその場で表示し、本人が「この内容にする / 末尾に追加」を選ぶまで保存しない。
 */
const ProfileAiAssist: React.FC<{ bio: string; onApply: (next: string) => void }> = ({ bio, onApply }) => {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'polish' | 'translate' | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPlanFeatures().then((f) => setAllowed(!!f.profile_polish)).catch(() => setAllowed(false));
  }, []);

  const otherLang = lang === 'ko' ? 'ja' : 'ko';

  const run = async (kind: 'polish' | 'translate') => {
    if (!bio.trim()) { toast({ title: t('polish.empty') }); return; }
    setBusy(kind);
    try {
      const r = kind === 'polish' ? await polishProfile(bio, lang) : await translateProfile(bio, otherLang);
      setSuggestion(r.translated);
    } catch (e) {
      const code = e instanceof TranslateError ? e.code : 'provider_failed';
      if (code === 'premium_required') setAllowed(false);
      const key: MessageKey = code === 'daily_limit' ? 'plans.limit.translation' : code === 'premium_required' ? 'premium.lockedTitle' : 'chat.translateFailed';
      toast({ title: t(key, { n: e instanceof TranslateError && typeof e.detail.per_day === 'number' ? e.detail.per_day : 0 }), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (allowed === null) return null;

  return (
    <div className="space-y-2" data-testid="profile-ai-assist">
      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" />{t('polish.title')}</p>
      {!allowed ? (
        <PremiumLock lead={t('polish.lockedLead')} />
      ) : (
        <>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => run('polish')}>
              <WandSparkles className="w-4 h-4" />{t('polish.polish')}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={() => run('translate')}>
              <Languages className="w-4 h-4" />{t('polish.translate', { lang: t(`lang.${otherLang}` as MessageKey) })}
            </Button>
          </div>
          {suggestion !== null && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-900">{t('polish.resultTitle')}</p>
              <p className="text-sm whitespace-pre-wrap break-words">{suggestion}</p>
              <p className="text-[11px] text-amber-800">{t('polish.resultLead')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="bg-rose-500 hover:bg-rose-600" onClick={() => { onApply(suggestion); setSuggestion(null); }}>{t('polish.apply')}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { onApply(`${bio.trimEnd()}\n\n${suggestion}`.slice(0, 1000)); setSuggestion(null); }}>{t('polish.applyAppend')}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestion(null)}>{t('polish.discard')}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfileAiAssist;
