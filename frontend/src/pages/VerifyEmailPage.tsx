import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { resilientFetch } from '../contexts/AuthContext';

const VerifyEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'already_verified' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(t('verify_email.no_token', '無効なリンクです。'));
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await resilientFetch('/api/stripe/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.status === 'verified') {
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setStatus('success');
          setTimeout(() => {
            navigate('/kyc-verification');
          }, 2000);
        } else if (response.ok && data.status === 'already_verified') {
          setStatus('already_verified');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setStatus('error');
          setErrorMessage(data.detail || t('verify_email.failed', 'メール確認に失敗しました。'));
        }
      } catch (_e) {
        setStatus('error');
        setErrorMessage(t('verify_email.network_error', 'ネットワークエラーが発生しました。'));
      }
    };

    verifyEmail();
  }, [token, navigate, t]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="flex justify-center mb-6">
              <Loader2 className="w-12 h-12 text-black animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-black mb-2">
              {t('verify_email.verifying', 'メールアドレスを確認中...')}
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-black mb-2">
              {t('verify_email.success', 'メールアドレスが確認されました！')}
            </h1>
            <p className="text-gray-600">
              {t('verify_email.redirecting', 'KYC本人確認ページへ移動します...')}
            </p>
          </>
        )}

        {status === 'already_verified' && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-12 h-12 text-blue-500" />
            </div>
            <h1 className="text-xl font-bold text-black mb-2">
              {t('verify_email.already_verified', 'このメールアドレスは既に確認済みです')}
            </h1>
            <p className="text-gray-600">
              {t('verify_email.redirect_login', 'ログインページへ移動します...')}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-6">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-black mb-4">
              {t('verify_email.error_title', '確認に失敗しました')}
            </h1>
            <p className="text-red-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/subscribe')}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              {t('verify_email.back_to_register', '登録ページに戻る')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
