import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-16 right-[-120px] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative container mx-auto px-4 sm:px-6 md:px-8 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
              <Shield className="h-4 w-4" />
              Carat Community
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-bold tracking-tight text-white">
              {t('privacyPage.title')}
            </h1>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl prose prose-gray prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none">

          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.intro')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section1Title')}
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-2 text-sm md:text-base leading-relaxed text-gray-700">
            <li><strong>{t('privacyPage.section1BusinessName')}</strong>：{t('privacyPage.section1BusinessNameValue')}</li>
            <li><strong>{t('privacyPage.section1Manager')}</strong>：{t('privacyPage.section1ManagerValue')}</li>
            <li><strong>{t('privacyPage.section1Address')}</strong>：{t('privacyPage.section1AddressValue')}</li>
            <li><strong>{t('privacyPage.section1Phone')}</strong>：{t('privacyPage.section1PhoneValue')}</li>
            <li><strong>{t('privacyPage.section1Email')}</strong>：<a href="mailto:ted@carat-community.com" className="text-blue-600 hover:underline">ted@carat-community.com</a></li>
          </ul>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section2Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section2Intro')}
          </p>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>{t('privacyPage.section2Item1')}</li>
            <li>{t('privacyPage.section2Item2')}</li>
            <li>{t('privacyPage.section2Item3')}</li>
            <li>{t('privacyPage.section2Item4')}</li>
            <li>
              {t('privacyPage.section2Item5')}
              <br />
              <span className="text-gray-500 text-xs md:text-sm">{t('privacyPage.section2Item5Note')}</span>
            </li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section3Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section3Intro')}
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-sm md:text-base leading-relaxed text-gray-700">
            <li>{t('privacyPage.section3Item1')}</li>
            <li>{t('privacyPage.section3Item2')}</li>
            <li>{t('privacyPage.section3Item3')}</li>
            <li>{t('privacyPage.section3Item4')}</li>
            <li>{t('privacyPage.section3Item5')}</li>
            <li>{t('privacyPage.section3Item6')}</li>
          </ul>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section4Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section4Text')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section5Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section5Text')}
          </p>
          <ul className="list-disc list-outside pl-5 space-y-2 text-sm md:text-base leading-relaxed text-gray-700">
            <li><strong>{t('privacyPage.section5Stripe')}</strong></li>
          </ul>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section6Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section6Text')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section7Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section7Text')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section8Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section8Text')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section9Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            <Trans
              i18nKey="privacyPage.section9Text"
              components={{ 1: <strong /> }}
            />
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section10Title')}
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            {t('privacyPage.section10Text')}
          </p>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            {t('privacyPage.section11Title')}
          </h2>
          <ul className="list-disc list-outside pl-5 space-y-2 text-sm md:text-base leading-relaxed text-gray-700">
            <li><strong>{t('privacyPage.section11Phone')}</strong>：06-6697-0034</li>
            <li><strong>{t('privacyPage.section11Email')}</strong>：<a href="mailto:ted@carat-community.com" className="text-blue-600 hover:underline">ted@carat-community.com</a></li>
          </ul>

          <div className="mt-12 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              <Link to="/about" className="hover:underline">{t('privacyPage.bottomAboutCarat')}</Link>
              {' ／ '}
              <Link to="/about/usage" className="hover:underline">{t('privacyPage.bottomUsage')}</Link>
              {' ／ '}
              <Link to="/about/terms" className="hover:underline">{t('privacyPage.bottomTerms')}</Link>
              {' ／ '}
              <Link to="/about/tokushoho" className="hover:underline">{t('privacyPage.bottomTokushoho')}</Link>
              {' ／ '}
              <Link to="/contact" className="hover:underline">{t('privacyPage.bottomContact')}</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicyPage;
