import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/ja';

// 添付画像 top-image03 → 01 → 02 の順。人物は右側に配置されているため、
// スマホでは右寄せの縦トリミング版を使い、見出しは左側の余白に HTML で重ねる。
const HERO_SLIDES: { id: string; title: MessageKey; sub: MessageKey }[] = [
  { id: 'top-image03', title: 'landing.hero1.title', sub: 'landing.hero1.sub' },
  { id: 'top-image01', title: 'landing.hero2.title', sub: 'landing.hero2.sub' },
  { id: 'top-image02', title: 'landing.hero3.title', sub: 'landing.hero3.sub' },
];

const INTERVAL_MS = 6000;

const HeroSlider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-rose-100 via-orange-50 to-amber-100 aspect-[3/4] sm:aspect-[16/9] max-h-[80vh]"
      aria-roledescription="carousel"
      aria-label={t('landing.hero.aria')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {HERO_SLIDES.map((s, i) => {
        const active = i === index;
        const base = `/assets/hero/${s.id}`;
        return (
          <div
            key={s.id}
            className={cn('absolute inset-0 transition-opacity duration-700 ease-in-out', active ? 'opacity-100' : 'opacity-0 pointer-events-none')}
            aria-hidden={!active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${HERO_SLIDES.length}`}
          >
            {!failed[s.id] && (
              <picture>
                <source media="(max-width: 639px)" srcSet={`${base}-mobile.webp`} />
                <source srcSet={`${base}-1000.webp 1000w, ${base}-1600.webp 1600w`} sizes="100vw" />
                <img
                  src={`${base}-1600.webp`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-right"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  onError={() => setFailed((f) => ({ ...f, [s.id]: true }))}
                />
              </picture>
            )}
            {/* 文字の可読性用: 左側 (余白側) と下部を白くぼかす */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/40 to-transparent sm:from-white/80 sm:via-white/20" />
            <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-white/90 via-white/60 to-transparent sm:hidden" />
            <div className="absolute inset-0 flex flex-col justify-end sm:justify-center px-5 pb-9 sm:px-10 sm:pb-0 max-w-3xl">
              <h1 className="text-[1.7rem] sm:text-4xl md:text-5xl font-bold leading-tight text-gray-900 break-keep drop-shadow-sm whitespace-pre-line">
                {t(s.title)}
              </h1>
              <p className="mt-2 sm:mt-3 text-sm sm:text-lg text-gray-700 break-keep whitespace-pre-line max-w-md">{t(s.sub)}</p>
              {children && <div className="mt-4 sm:mt-5">{children}</div>}
            </div>
          </div>
        );
      })}
      <div className="absolute bottom-2 sm:bottom-4 inset-x-0 flex justify-center gap-2" role="tablist">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`${i + 1} / ${HERO_SLIDES.length}`}
            onClick={() => setIndex(i)}
            className={cn('h-2.5 rounded-full transition-all', i === index ? 'w-6 bg-rose-600' : 'w-2.5 bg-white/80 border border-rose-300')}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSlider;
