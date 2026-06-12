import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setRefCodeCookie } from '../components/ReferralTracker';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Persist referral code from URL params into cookie
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setRefCodeCookie(ref);
    }
  }, [searchParams]);

  return (
    <div className="bg-white">
      {/* Hero section */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-sm text-gray-500 border border-gray-200 rounded-full px-4 py-1 mb-6">
            {t('about.badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 leading-tight mb-6">
            {t('about.heroTitle')}
          </h1>
          <p className="text-gray-600 text-base md:text-lg leading-relaxed whitespace-pre-line max-w-3xl mx-auto">
            {t('about.heroLead')}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['crossBorder', 'growTogether', 'respectEmpathy'] as const).map((key) => (
              <div key={key} className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-serif font-semibold text-gray-900 mb-3">
                  {t(`about.features.${key}.title`)}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {t(`about.features.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Caratでできること */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-4">
            {t('about.canDo.title')}
          </h2>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line mb-8">
            {t('about.canDo.body')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['everyday', 'expression'] as const).map((key) => (
              <div key={key} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-serif font-semibold text-gray-900 mb-3">
                  {t(`about.canDo.cards.${key}.title`)}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {t(`about.canDo.cards.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* カラットとは */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">
              カラットとは
            </h2>
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-8 md:p-10">
              <div className="text-gray-800 leading-relaxed">
                <p>Caratは</p>
                <p className="mt-1">・会員交流</p>
                <p>・会員サロン</p>
                <p>・ビジネス</p>
                <p className="mt-4 text-gray-700">
                  の3つの機能で構成された会員制LGBTQ+コミュニティです。
                </p>
                <p className="mt-4 text-gray-700">
                  月会費770円（税込）でご利用いただけます。
                </p>
                <p className="mt-4 text-gray-700">ビジネス機能は手数料不要です。</p>
                <p className="mt-1 text-gray-700">会員同士で直接やり取りしてください。</p>
              </div>
            </div>
          </div>

          {/* Safety section */}
          <div className="max-w-5xl mx-auto">
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
              {(['kyc', 'moderation', 'security'] as const).map((key) => (
                <div key={key} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-gray-900">{t(`about.safety.cards.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    {t(`about.safety.cards.${key}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA: 会員登録誘導 */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-16 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Caratに参加しませんか？
            </h2>
            <p className="text-gray-300 text-lg mb-3">
              月額770円（税込）で全機能をご利用いただけます
            </p>
            <p className="text-gray-400 text-sm mb-8">
              会員交流・会員サロン・ビジネス機能が使い放題。本人確認済みの安心なコミュニティです。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/subscribe"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 hover:bg-gray-100 transition-colors shadow-lg"
              >
                会員登録する
              </Link>
              <Link
                to="/about/usage"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-500 px-8 py-4 text-lg font-medium text-white hover:bg-gray-700 transition-colors"
              >
                ご利用方法を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Carat description closing */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-8 md:p-10">
            <p className="text-gray-900 text-lg md:text-xl font-semibold leading-relaxed mb-4">
              Caratは、会員交流・会員サロン・ビジネスの3つの機能で構成された会員制LGBTQ+コミュニティです。
            </p>
            <p className="text-gray-700 leading-relaxed mb-6">
              {t('about.closingQuote')}
            </p>
            <div className="flex items-center justify-between flex-wrap gap-4">
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
