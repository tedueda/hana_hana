import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { resilientFetch } from '../contexts/AuthContext';

const KycVerificationPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [kycConfirmed, setKycConfirmed] = useState(false);
  const [pollingKyc, setPollingKyc] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollKycStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await resilientFetch('/api/stripe/kyc-status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.can_proceed_to_payment) {
          setKycConfirmed(true);
          setPollingKyc(false);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.warn('KYC status poll failed:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startVerification = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError(t('kyc.page.no_auth'));
      setLoading(false);
      return;
    }

    try {
      const configRes = await resilientFetch('/api/stripe/config');
      if (!configRes.ok) throw new Error('Failed to load Stripe config');
      const configData = await configRes.json();

      const stripeLocale = (i18n.language || 'ja').substring(0, 2) as 'ja' | 'en';
      const stripePromise = loadStripe(configData.publishable_key, { locale: stripeLocale });

      const res = await resilientFetch('/api/stripe/create-identity-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 400 && data.detail === 'Identity already verified') {
          setVerificationComplete(true);
          setKycConfirmed(true);
          setLoading(false);
          return;
        }
        throw new Error(data.detail || t('kyc.page.session_error'));
      }

      const { client_secret } = await res.json();
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      setLoading(false);

      const result = await stripe.verifyIdentity(client_secret);

      if (result.error) {
        setError(result.error.message || t('kyc.page.verification_error'));
      } else {
        setVerificationComplete(true);
        setPollingKyc(true);
        pollIntervalRef.current = setInterval(pollKycStatus, 3000);
        pollKycStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kyc.page.unknown_error'));
      setLoading(false);
    }
  }, [t, pollKycStatus]);

  useEffect(() => {
    startVerification();
  }, [startVerification]);

  const handleContinueToPayment = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/subscribe');
      return;
    }

    try {
      const res = await resilientFetch('/api/stripe/start-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          setError(t('kyc.page.kyc_not_confirmed', 'KYC確認がまだ完了していません。しばらくお待ちください。'));
          setLoading(false);
          return;
        }
        throw new Error(data.detail || t('kyc.page.checkout_error'));
      }

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kyc.page.unknown_error'));
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    startVerification();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-800 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('kyc.page.loading')}</p>
        </div>
      </div>
    );
  }

  if (verificationComplete) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            {kycConfirmed ? (
              <>
                <h1 className="text-2xl font-bold text-black mb-4">
                  {t('kyc.page.complete_title')}
                </h1>
                <p className="text-gray-600 mb-6">
                  {t('kyc.page.complete_message')}
                </p>
                <div className="bg-gray-100 rounded-lg p-4 mb-6 border border-gray-200">
                  <h3 className="text-black font-semibold mb-2">
                    {t('kyc.page.next_step_title')}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {t('kyc.page.next_step_message')}
                  </p>
                </div>
                <button
                  onClick={handleContinueToPayment}
                  className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200"
                >
                  {t('kyc.page.continue_to_payment')}
                </button>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-black mb-4">
                  {t('kyc.page.pending_title', '本人確認を処理中です')}
                </h1>
                <p className="text-gray-600 mb-6">
                  {t('kyc.page.pending_message', 'Stripeで本人確認を処理しています。確認が完了するまでお待ちください。通常数分で完了します。')}
                </p>
                {pollingKyc && (
                  <div className="flex items-center justify-center mb-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-800 mr-3"></div>
                    <span className="text-gray-600 text-sm">{t('kyc.page.checking_status', '確認中...')}</span>
                  </div>
                )}
                <button
                  disabled
                  className="w-full py-4 bg-gray-300 text-gray-500 font-bold rounded-lg cursor-not-allowed"
                >
                  {t('kyc.page.waiting_for_verification', 'KYC確認待ち...')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <h1 className="text-2xl font-bold text-black mb-4">
              {t('kyc.page.error_title')}
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors"
              >
                {t('kyc.page.retry')}
              </button>
              <button
                onClick={() => navigate('/subscribe')}
                className="w-full py-3 bg-white hover:bg-gray-50 text-black font-semibold rounded-lg border border-gray-300 transition-colors"
              >
                {t('kyc.page.back_to_register')}
              </button>
            </div>
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
          <h1 className="text-2xl font-bold text-black mb-4">
            {t('kyc.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('kyc.description')}
          </p>
          <button
            onClick={handleRetry}
            className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200"
          >
            {t('kyc.start_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KycVerificationPage;
