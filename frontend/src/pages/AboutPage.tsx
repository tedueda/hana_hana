import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MemberMenuCards from '../components/MemberMenuCards';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white">
      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-5xl">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">カラットとは</h1>
          <div className="rounded-2xl border border-gray-200 bg-white p-8 md:p-10 shadow-sm">
            <p className="text-lg md:text-xl leading-relaxed text-gray-900 whitespace-pre-line">
              {'Caratは\n\n・マッチング\n・会員サロン\n・ビジネス\n\nの3つの機能で構成された\n会員制LGBTQ+コミュニティです。\n\n月会費1000円（税込）でご利用いただけます。\n\nビジネス機能は手数料不要です。\n会員同士で直接やり取りしてください。'}
            </p>
          </div>

          {/* 会員メニューカード */}
          <MemberMenuCards />
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
