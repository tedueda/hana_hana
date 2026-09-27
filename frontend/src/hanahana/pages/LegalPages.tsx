import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '../labels';
import { useI18n, type Lang } from '../i18n';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { DEFAULT_PUBLIC_SETTINGS, fetchPublicSettings, type PublicSettings } from '../api/settings';
import { LEGAL_DOCS, type LegalKind } from '../legal/content';

const LegalPage: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const { t, lang } = useI18n();
  const { session } = useSupabaseAuth();
  const [pub, setPub] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  useEffect(() => {
    fetchPublicSettings().then(setPub).catch(() => undefined);
  }, []);

  const doc = LEGAL_DOCS[kind][lang as Lang];
  const version = kind === 'terms' ? pub.terms_version : kind === 'privacy' ? pub.privacy_version : null;
  const back = session ? '/app/settings' : '/app/welcome';
  const title = kind === 'terms' ? t('legal.terms') : kind === 'privacy' ? t('legal.privacy') : t('legal.help');

  return (
    <div className="min-h-screen bg-gray-50 pt-[env(safe-area-inset-top)]">
      <div className="max-w-3xl mx-auto px-4 py-4 pb-24 space-y-4">
        <div className="flex items-center gap-1 -ml-2">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11">
            <Link to={back} aria-label={t('common.back')}><ChevronLeft className="w-6 h-6" /></Link>
          </Button>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3">{t('legal.draft')}</p>
        <article className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4 text-sm leading-relaxed break-words">
          <header className="text-xs text-gray-500">
            {APP_NAME}
            {version && ` · ${t('settings.version', { version })}`}
          </header>
          {doc.map((sec, i) => (
            <section key={i} className="space-y-1">
              <h2 className="font-semibold">{sec.heading}</h2>
              {sec.body.map((p, j) => <p key={j}>{p}</p>)}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
};

export const TermsPage: React.FC = () => <LegalPage kind="terms" />;
export const PrivacyPage: React.FC = () => <LegalPage kind="privacy" />;
export const HelpPage: React.FC = () => <LegalPage kind="help" />;
