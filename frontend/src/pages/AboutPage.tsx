import React from 'react';
import { Link } from 'react-router-dom';
import { Globe2, HeartHandshake, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import tourismHero from '../assets/images/tourism01.jpg';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-white" />
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-16 right-[-120px] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-[-160px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              {t('about.badge')}
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-2xl">
              <div className="relative aspect-[16/9] md:aspect-[21/9]">
                <img
                  src={tourismHero}
                  alt="Carat concept visual"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
              </div>
            </div>

            <h1 className="mt-6 text-3xl md:text-5xl font-bold tracking-tight text-white">
              {t('about.heroTitle')}
            </h1>

            <p className="mt-6 text-base md:text-lg leading-relaxed text-white/85 max-w-3xl">
              {t('about.heroLead')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/feed"
                className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {t('about.cta.community')}
              </Link>
              <Link
                to="/subscribe"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-colors border border-white/15 backdrop-blur"
              >
                {t('about.cta.plans')}
              </Link>
            </div>
          </div>

          <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-5">
              <div className="flex items-center gap-3 text-white">
                <Globe2 className="h-5 w-5" />
                <h3 className="font-semibold">{t('about.features.crossBorder.title')}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {t('about.features.crossBorder.body')}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-5">
              <div className="flex items-center gap-3 text-white">
                <Users className="h-5 w-5" />
                <h3 className="font-semibold">{t('about.features.growTogether.title')}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {t('about.features.growTogether.body')}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-5">
              <div className="flex items-center gap-3 text-white">
                <HeartHandshake className="h-5 w-5" />
                <h3 className="font-semibold">{t('about.features.respectEmpathy.title')}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {t('about.features.respectEmpathy.body')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('about.canDo.title')}</h2>
          <p className="mt-3 text-gray-700 leading-relaxed">
            {t('about.canDo.body')}
          </p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">{t('about.canDo.cards.everyday.title')}</h3>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                {t('about.canDo.cards.everyday.body')}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">{t('about.canDo.cards.expression.title')}</h3>
              <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                {t('about.canDo.cards.expression.body')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('about.safety.title')}</h2>
            </div>

            <p className="mt-4 text-gray-700 leading-relaxed">
              {t('about.safety.body')}
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.kyc.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.kyc.body')}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.moderation.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.moderation.body')}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">{t('about.safety.cards.security.title')}</h3>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                  {t('about.safety.cards.security.body')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-14 md:py-20">
        <div className="max-w-4xl">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-8 md:p-10">
            <p className="text-gray-900 text-lg md:text-xl font-semibold leading-relaxed">
              {t('about.closingQuote')}
            </p>
            <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
              <div className="text-sm text-gray-600">
                <div className="font-semibold text-gray-900">{t('about.operatorLabel')}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/subscribe"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {t('about.cta.plans')}
                </Link>
                <Link
                  to="/about/usage"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  ご利用方法を見る
                </Link>
                <Link
                  to="/feed"
                  className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
                >
                  {t('about.cta.getStarted')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
