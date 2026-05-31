import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { resilientFetch } from '../contexts/AuthContext';

type Step = 'input' | 'stripe' | 'polling' | 'complete' | 'mismatch' | 'review' | 'error';

const DOCUMENT_TYPES = [
  { value: 'drivers_license', label: '運転免許証', labelEn: "Driver's License" },
  { value: 'my_number_card', label: 'マイナンバーカード', labelEn: 'My Number Card' },
  { value: 'passport', label: 'パスポート', labelEn: 'Passport' },
];

const KycVerificationPage: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storedUser = localStorage.getItem('user');
  const userInfo = (() => {
    try { return storedUser ? JSON.parse(storedUser) : null; } catch { return null; }
  })();
  const isFounderFree = !!(userInfo?.is_founder_free_member || userInfo?.subscription_exempt);
  const cardRequired = userInfo?.card_required !== false;

  const [step, setStep] = useState<Step>('input');
  const [realName, setRealName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [documentType, setDocumentType] = useState('drivers_license');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [nameMatch, setNameMatch] = useState(true);
  const [dateMatch, setDateMatch] = useState(true);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleSubmitIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
      setError('認証が必要です。再度ログインしてください。');
      setLoading(false);
      return;
    }

    try {
      const res = await resilientFetch('/api/stripe/submit-identity-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          real_name: realName,
          birthdate,
          document_type: documentType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.detail === 'Identity already verified') {
          setStep('complete');
          setLoading(false);
          return;
        }
        if (data.detail === 'IDENTITY_MAX_RETRIES') {
          setStep('review');
          setLoading(false);
          return;
        }
        throw new Error(data.detail || '本人確認の開始に失敗しました');
      }

      const { client_secret } = await res.json();

      const configRes = await resilientFetch('/api/stripe/config');
      if (!configRes.ok) throw new Error('Stripe設定の読み込みに失敗しました');
      const configData = await configRes.json();

      const stripeLocale = (i18n.language || 'ja').substring(0, 2) as 'ja' | 'en';
      const stripe = await loadStripe(configData.publishable_key, { locale: stripeLocale });
      if (!stripe) throw new Error('Stripeの読み込みに失敗しました');

      setStep('stripe');
      setLoading(false);

      const result = await stripe.verifyIdentity(client_secret);

      if (result.error) {
        setError(result.error.message || '本人確認でエラーが発生しました');
        setStep('error');
      } else {
        setStep('polling');
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setStep('error');
      setLoading(false);
    }
  };

  const startPolling = useCallback(() => {
    const poll = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await resilientFetch('/api/stripe/kyc-status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.kyc_status === 'VERIFIED' && data.identity_match) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;

          const storedU = localStorage.getItem('user');
          if (storedU) {
            try {
              const u = JSON.parse(storedU);
              u.account_status = data.account_status;
              u.kyc_status = 'VERIFIED';
              localStorage.setItem('user', JSON.stringify(u));
            } catch { /* ignore parse error */ }
          }
          setStep('complete');
        } else if (data.kyc_status === 'MISMATCH') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setRetryCount(data.retry_count || 0);
          setNameMatch(data.name_match !== false);
          setDateMatch(data.date_match !== false);
          if (data.account_status === 'identity_review') {
            setStep('review');
          } else {
            setStep('mismatch');
          }
        }
      } catch (err) {
        console.warn('KYC polling error:', err);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);
  }, []);

  const handleContinue = async () => {
    if (isFounderFree || !cardRequired) {
      navigate('/matching/profile');
      return;
    }

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
        throw new Error(data.detail || 'カード登録の開始に失敗しました');
      }

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
      setLoading(false);
    }
  };

  const handleRetryMismatch = () => {
    setStep('input');
    setError(null);
  };

  // Loading state
  if (step === 'stripe' || (step === 'input' && loading)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-800 mx-auto mb-4" />
          <p className="text-gray-600">本人確認書類の確認を準備中です...</p>
        </div>
      </div>
    );
  }

  // Polling state
  if (step === 'polling') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">本人確認を処理中です</h1>
            <p className="text-gray-600 mb-6">
              本人確認書類を確認しています。通常数分で完了します。
            </p>
            <div className="flex items-center justify-center mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-800 mr-3" />
              <span className="text-gray-600 text-sm">確認中...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Complete state
  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">本人確認が完了しました</h1>
            {isFounderFree || !cardRequired ? (
              <p className="text-gray-600 mb-6">
                招待会員として登録されているため、クレジットカード登録は不要です。
                続いてプロフィールを設定してください。
              </p>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  本人確認が完了しました。次にクレジットカード登録を行ってください。
                </p>
                <div className="bg-gray-100 rounded-lg p-4 mb-6 border border-gray-200">
                  <h3 className="text-black font-semibold mb-2">次のステップ</h3>
                  <p className="text-gray-600 text-sm">クレジットカードを登録して会員登録を完了します。</p>
                </div>
              </>
            )}
            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              {loading ? '処理中...' : (isFounderFree || !cardRequired ? 'プロフィール編集へ進む' : 'クレジットカード登録へ進む')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mismatch state
  if (step === 'mismatch') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">情報が一致しませんでした</h1>
            <p className="text-gray-600 mb-4">
              入力された情報と本人確認書類の内容が一致しませんでした。
              本名・生年月日をご確認のうえ、再度お手続きください。
            </p>
            <div className="bg-yellow-50 rounded-lg p-4 mb-6 border border-yellow-200 text-left">
              <p className="text-sm text-yellow-800">
                {!nameMatch && <span className="block">・氏名が一致しません</span>}
                {!dateMatch && <span className="block">・生年月日が一致しません</span>}
                <span className="block mt-2 text-yellow-700">
                  再入力回数: {retryCount} / {maxRetries}
                </span>
              </p>
            </div>
            <button
              onClick={handleRetryMismatch}
              className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200"
            >
              再度入力する
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review state
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">運営確認待ち</h1>
            <p className="text-gray-600 mb-6">
              複数回の照合不一致のため、運営チームが手動で確認を行います。
              確認が完了次第、登録メールアドレスにご連絡いたします。
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-black font-bold rounded-lg transition-all duration-200"
            >
              ログイン画面へ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200 text-center">
            <h1 className="text-2xl font-bold text-black mb-4">エラーが発生しました</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => { setStep('input'); setError(null); }}
                className="w-full py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-lg transition-colors"
              >
                再度やり直す
              </button>
              <button
                onClick={() => navigate('/subscribe')}
                className="w-full py-3 bg-white hover:bg-gray-50 text-black font-semibold rounded-lg border border-gray-300 transition-colors"
              >
                登録画面へ戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Input form (step === 'input')
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="/images/logo02.png" alt="Carat Logo" className="h-16 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">本人確認</h1>
            <p className="text-gray-500 text-sm">
              本人確認書類で氏名・生年月日を照合します
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
            <p className="text-sm text-blue-800">
              本名・生年月日は本人確認のためだけに使用されます。
              プロフィールや投稿画面には表示されません。
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmitIdentity} className="space-y-5">
            <div>
              <label className="block text-black text-sm font-medium mb-2">
                本名（漢字またはフルネーム）
              </label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                placeholder="例：山田 太郎"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                本人確認書類に記載されている通りに入力してください
              </p>
            </div>

            <div>
              <label className="block text-black text-sm font-medium mb-2">
                生年月日
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                required
              />
            </div>

            <div>
              <label className="block text-black text-sm font-medium mb-2">
                本人確認書類
              </label>
              <div className="space-y-2">
                {DOCUMENT_TYPES.map((doc) => (
                  <label
                    key={doc.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      documentType === doc.value
                        ? 'border-black bg-gray-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="document_type"
                      value={doc.value}
                      checked={documentType === doc.value}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="mr-3 text-black focus:ring-black"
                    />
                    <span className="text-black text-sm">
                      {doc.label}
                      <span className="text-gray-400 ml-2 text-xs">({doc.labelEn})</span>
                    </span>
                  </label>
                ))}
              </div>
              {documentType === 'my_number_card' && (
                <p className="text-xs text-orange-600 mt-2">
                  ※ マイナンバー（個人番号）は取得・保存されません
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !realName.trim() || !birthdate}
              className="w-full py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '処理中...' : '本人確認書類を提出する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default KycVerificationPage;
