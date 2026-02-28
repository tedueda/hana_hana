import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, RefreshCw } from 'lucide-react';
import { resilientFetch } from '../contexts/AuthContext';

const EmailVerificationPendingPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as { email?: string })?.email || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await resilientFetch('/api/stripe/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch (_e) {
      /* ignore */
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
          <p className="text-gray-600 mb-4">{t('email_verification.no_email', 'メールアドレスが指定されていません。')}</p>
          <button onClick={() => navigate('/subscribe')} className="text-black underline">
            {t('email_verification.back_to_register', '登録ページに戻る')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-black mb-4">
          {t('email_verification.title', 'メールを確認してください')}
        </h1>
        <p className="text-gray-600 mb-2">
          {t('email_verification.sent_to', '確認メールを送信しました：')}
        </p>
        <p className="text-black font-semibold mb-6">{email}</p>
        <p className="text-gray-500 text-sm mb-8">
          {t('email_verification.instruction', 'メール内のリンクをクリックして、メールアドレスを確認してください。確認後、KYC本人確認に進めます。')}
        </p>

        {resent ? (
          <p className="text-green-600 text-sm mb-4">
            {t('email_verification.resent', '確認メールを再送信しました。')}
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-2 text-black hover:text-gray-700 underline text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
            {t('email_verification.resend', 'メールが届かない場合、再送信する')}
          </button>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button onClick={() => navigate('/login')} className="text-gray-500 hover:text-gray-700 text-sm underline">
            {t('email_verification.back_to_login', 'ログインページに戻る')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPendingPage;
