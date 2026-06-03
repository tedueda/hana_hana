import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { resilientFetch } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { getRefCodeFromCookie } from '../utils/referral';
import { BACKEND_URL } from '../config';

const COUNTRIES = [
  { code: 'JP', name: 'Japan' },
  { code: 'US', name: 'United States' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'CN', name: 'China' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IN', name: 'India' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'OTHER', name: 'Other' }
];

const LANGUAGES = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: 'English' },
  { code: 'ko', name: '한국어' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' }
];

interface RefValidation {
  valid: boolean;
  reason?: string;
  ref_type?: 'founder' | 'ambassador';
  founder_code?: string;
  founder_display_name?: string;
  remaining?: number;
  total?: number;
  limit?: number;
  ambassador_code?: string;
  ambassador_display_name?: string;
}

const SubscribePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentLanguage } = useLanguage();
  
  const canceled = searchParams.get('canceled') === 'true';
  const refFromUrl = searchParams.get('ref');
  const refFromCookie = getRefCodeFromCookie();
  const refCode = refFromUrl || refFromCookie || null;

  const [refValidation, setRefValidation] = useState<RefValidation | null>(null);

  React.useEffect(() => {
    if (!refCode) return;
    fetch(`${BACKEND_URL}/api/referrals/validate?ref=${encodeURIComponent(refCode)}`)
      .then((res) => res.json())
      .then((data: RefValidation) => setRefValidation(data))
      .catch(() => setRefValidation(null));
  }, [refCode]);

  const isFounderFree = !!(refCode && refValidation?.valid && refValidation?.ref_type === 'founder');
  const isAmbassadorPaid = !!(refCode && refValidation?.valid && refValidation?.ref_type === 'ambassador');

  // Ambassador (paid) referral codes: redirect to /about page so user can browse first
  // Only redirect when ref came from URL param (not cookie) to avoid infinite loop
  React.useEffect(() => {
    if (isAmbassadorPaid && refFromUrl) {
      navigate(`/about?ref=${encodeURIComponent(refFromUrl)}`, { replace: true });
    }
  }, [isAmbassadorPaid, refFromUrl, navigate]);
  
  const [formData, setFormData] = useState({
    email: '',
    display_name: '',
    password: '',
    password_confirm: '',
    preferred_lang: currentLanguage,
    residence_country: 'JP',
    terms_accepted: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!formData.email || !formData.display_name || !formData.password) {
      setError(t('subscribe.error.required_fields'));
      return;
    }
    
    if (formData.password !== formData.password_confirm) {
      setError(t('subscribe.error.password_mismatch'));
      return;
    }
    
    if (formData.password.length < 8) {
      setError(t('subscribe.error.password_too_short'));
      return;
    }
    
    if (!formData.terms_accepted) {
      setError(t('subscribe.error.terms_required'));
      return;
    }
    
    setLoading(true);
    
    try {
      // Get ref code from URL param or cookie
      const refFromUrl = searchParams.get('ref');
      const refFromCookie = getRefCodeFromCookie();
      const refCode = refFromUrl || refFromCookie || null;

      const response = await resilientFetch('/api/stripe/register-only', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          display_name: formData.display_name,
          password: formData.password,
          preferred_lang: formData.preferred_lang,
          residence_country: formData.residence_country,
          terms_accepted: formData.terms_accepted,
          ref: refCode
        })
      });
      
      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail || t('subscribe.error.checkout_failed');
        throw new Error(detail);
      }

      if (data.status === 'email_verification_required') {
        navigate('/email-verification-pending', { state: { email: data.email, ref: refCode } });
      } else if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // All members go to KYC after registration.
        // Founder free members skip Stripe payment after KYC.
        navigate('/kyc-verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('subscribe.error.unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-3xl font-bold text-black mb-2">
              {isFounderFree ? t('subscribe.title_founder', '招待会員になる') : t('subscribe.title')}
            </h1>
            <p className="text-gray-500">
              {isFounderFree
                ? t('subscribe.subtitle_founder', { defaultValue: '{{name}}さんからの紹介で無料登録できます', name: refValidation?.founder_display_name || '' })
                : isAmbassadorPaid
                ? `${refValidation?.ambassador_display_name || ''}さんからの紹介で有料会員登録`
                : t('subscribe.subtitle')}
            </p>
            {isAmbassadorPaid && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 font-semibold">有料会員紹介</p>
                <p className="text-sm text-blue-600">紹介コード: <span className="font-mono font-bold">{refCode}</span></p>
                <p className="text-xs text-blue-500 mt-1">登録後、本人確認とクレジットカード登録が必要です</p>
              </div>
            )}
            {!isFounderFree && (
              <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
                <p className="text-2xl font-bold text-black">
                  ¥770<span className="text-sm font-normal text-gray-500">/{t('subscribe.per_month')}</span>
                </p>
              </div>
            )}
          </div>
          
          {canceled && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700 text-sm">
                {t('subscribe.canceled_message')}
              </p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-black text-sm font-medium mb-2">
                {t('subscribe.email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-black text-sm font-medium mb-2">
                {t('subscribe.display_name')}
              </label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                placeholder={t('subscribe.display_name_placeholder')}
                required
              />
            </div>

            <div>
              <label className="block text-black text-sm font-medium mb-2">
                {t('subscribe.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black pr-12"
                  placeholder="********"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-black text-sm font-medium mb-2">
                {t('subscribe.password_confirm')}
              </label>
              <div className="relative">
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  name="password_confirm"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black pr-12"
                  placeholder="********"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <label htmlFor="preferred_lang" className="block text-black text-sm font-medium mb-2">
                {t('subscribe.preferred_language')}
              </label>
              <select
                id="preferred_lang"
                name="preferred_lang"
                value={formData.preferred_lang}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-white">
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="residence_country" className="block text-black text-sm font-medium mb-2">
                {t('subscribe.residence_country')}
              </label>
              <select
                id="residence_country"
                name="residence_country"
                value={formData.residence_country}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
              >
                {COUNTRIES.map(country => (
                  <option key={country.code} value={country.code} className="bg-white">
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-start">
              <input
                id="terms_accepted"
                type="checkbox"
                name="terms_accepted"
                checked={formData.terms_accepted}
                onChange={handleChange}
                className="mt-1 h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                required
              />
              <label htmlFor="terms_accepted" className="ml-3 text-sm text-gray-600">
                <Link to="/about/terms" target="_blank" className="text-black hover:text-gray-700 underline">利用規約</Link>
                および
                <Link to="/privacy" target="_blank" className="text-black hover:text-gray-700 underline">プライバシーポリシー</Link>
                に同意します
              </label>
            </div>
            
            <p className="text-xs text-gray-400">
              申込により、<Link to="/about/terms" target="_blank" className="underline hover:text-gray-600">利用規約</Link>および<Link to="/privacy" target="_blank" className="underline hover:text-gray-600">プライバシーポリシー</Link>に同意したものとみなします。
              <Link to="/about/tokushoho" target="_blank" className="underline hover:text-gray-600">特定商取引法に基づく表記</Link>
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('subscribe.processing') : t('subscribe.submit_button')}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              {t('subscribe.already_member')}{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-black hover:text-gray-700 underline"
              >
                {t('subscribe.login_link')}
              </button>
            </p>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-black font-semibold mb-3">{t('subscribe.benefits_title')}</h3>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li className="flex items-center">
                <span className="mr-2">💎</span>
                {t('subscribe.benefit_1')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">💬</span>
                {t('subscribe.benefit_2')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">🛍️</span>
                {t('subscribe.benefit_3')}
              </li>
              <li className="flex items-center">
                <span className="mr-2">💍</span>
                {t('subscribe.benefit_4')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
