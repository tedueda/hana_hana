import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resilientFetch } from '../contexts/AuthContext';

const SubscribeSuccessPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError(t('subscribe.success.no_session'));
      setLoading(false);
      return;
    }

    const verifySession = async () => {
      try {
        const response = await resilientFetch(`/api/stripe/checkout-session/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(t('subscribe.success.verification_failed'));
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.access_token) {
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.removeItem('anonymous');
          window.location.href = '/feed';
          return;
        } else if (data.status === 'kyc_required') {
          setError(t('subscribe.success.kyc_required', 'KYC本人確認が未完了のため、ログインできません。本人確認を完了してください。'));
        } else if (data.status === 'pending') {
          setError(t('subscribe.success.payment_pending'));
        } else {
          setError(t('subscribe.success.verification_failed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('subscribe.success.unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [searchParams, t]);

  const handleContinue = () => {
    navigate('/feed');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('subscribe.success.verifying')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-black mb-4">
              {t('subscribe.success.error_title')}
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleLogin}
              className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors"
            >
              {t('subscribe.success.go_to_login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
          <div className="flex justify-center mb-4">
            <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
          </div>
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-black mb-4">
            {t('subscribe.success.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('subscribe.success.message')}
          </p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-6 border border-gray-200">
            <h3 className="text-black font-semibold mb-2">
              {t('subscribe.success.next_step_title')}
            </h3>
            <p className="text-gray-600 text-sm">
              {t('subscribe.success.next_step_message')}
            </p>
          </div>
          
          <button
            onClick={handleContinue}
            className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200"
          >
            {t('subscribe.success.continue_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscribeSuccessPage;
