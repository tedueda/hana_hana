import React from 'react';
import { cn } from '@/lib/utils';
import { LANGS, LANG_NAMES, useI18n, type Lang } from '../i18n';

interface Props {
  className?: string;
  size?: 'sm' | 'md';
  onChange?: (l: Lang) => void;
}

/** ログイン前から使える表示言語スイッチ (日本語 / 한국어) */
const LangSwitch: React.FC<Props> = ({ className, size = 'sm', onChange }) => {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t('auth.uiLang')}
      className={cn('inline-flex rounded-full border border-gray-200 bg-white p-0.5', className)}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          lang={l}
          onClick={() => {
            setLang(l);
            onChange?.(l);
          }}
          className={cn(
            'rounded-full font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400',
            size === 'sm' ? 'px-3 py-1 text-xs min-h-[32px]' : 'px-4 py-2 text-sm min-h-[44px]',
            lang === l ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {LANG_NAMES[l]}
        </button>
      ))}
    </div>
  );
};

export default LangSwitch;
