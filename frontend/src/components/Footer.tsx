import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AccordionSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-sm font-semibold text-white"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
};

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 text-white mt-16">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14">

        {/* PC: 3-column */}
        <div className="hidden md:grid md:grid-cols-3 gap-12">
          <div>
            <h4 className="text-sm font-semibold mb-4 text-white">{t('footer.operatorInfo')}</h4>
            <div className="space-y-2 text-sm text-gray-400 leading-relaxed">
              <p className="font-medium text-gray-300">{t('footer.companyName')}</p>
              <p>{t('footer.responsiblePerson')}</p>
              <p>{t('footer.address')}</p>
              <p>TEL：<a href="tel:06-6697-0034" className="hover:text-white transition-colors">06-6697-0034</a></p>
              <p>Mail：<a href="mailto:ted@carat-community.com" className="hover:text-white transition-colors">ted@carat-community.com</a></p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white">{t('footer.siteGuide')}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">{t('footer.aboutCarat')}</Link></li>
              <li><Link to="/about/usage" className="text-gray-400 hover:text-white transition-colors">{t('footer.usage')}</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-white transition-colors">{t('footer.contact')}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-white">{t('footer.legalTerms')}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/about/terms" className="text-gray-400 hover:text-white transition-colors">{t('footer.terms')}</Link></li>
              <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
              <li><Link to="/about/tokushoho" className="text-gray-400 hover:text-white transition-colors">{t('footer.tokushoho')}</Link></li>
            </ul>
          </div>
        </div>

        {/* SP: Accordion */}
        <div className="md:hidden space-y-0">
          <AccordionSection title={t('footer.operatorInfo')}>
            <div className="space-y-2 text-sm text-gray-400 leading-relaxed pl-1">
              <p className="font-medium text-gray-300">{t('footer.companyName')}</p>
              <p>{t('footer.responsiblePerson')}</p>
              <p>{t('footer.address')}</p>
              <p>TEL：<a href="tel:06-6697-0034" className="hover:text-white transition-colors">06-6697-0034</a></p>
              <p>Mail：<a href="mailto:ted@carat-community.com" className="hover:text-white transition-colors">ted@carat-community.com</a></p>
            </div>
          </AccordionSection>

          <AccordionSection title={t('footer.siteGuide')}>
            <ul className="space-y-3 text-sm pl-1">
              <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">{t('footer.aboutCarat')}</Link></li>
              <li><Link to="/about/usage" className="text-gray-400 hover:text-white transition-colors">{t('footer.usage')}</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-white transition-colors">{t('footer.contact')}</Link></li>
            </ul>
          </AccordionSection>

          <AccordionSection title={t('footer.legalTerms')}>
            <ul className="space-y-3 text-sm pl-1">
              <li><Link to="/about/terms" className="text-gray-400 hover:text-white transition-colors">{t('footer.terms')}</Link></li>
              <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
              <li><Link to="/about/tokushoho" className="text-gray-400 hover:text-white transition-colors">{t('footer.tokushoho')}</Link></li>
            </ul>
          </AccordionSection>
        </div>

        {/* Copyright bar */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500 space-y-1">
          <p>&copy; {new Date().getFullYear()} Potential Design. All rights reserved.</p>
          <p>{t('footer.recommendedBrowsers')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
