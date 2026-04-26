import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaidMember } from '../hooks/usePremium';
import { Button } from './ui/button';

/**
 * 有料会員専用ルートガード
 * 未ログインまたは無料ユーザーの場合はモーダルを表示し、/feed にリダイレクト
 */
const PaidMemberRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { isPaidUser, loading: paidLoading } = usePaidMember();
  const [dismissed, setDismissed] = useState(false);

  if (authLoading || paidLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // 有料会員ならそのまま表示
  if (user && isPaidUser) {
    return <>{children}</>;
  }

  // モーダルを閉じた場合は /feed にリダイレクト
  if (dismissed) {
    return <Navigate to="/feed" replace />;
  }

  // 未ログインまたは無料ユーザー
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
          この機能は有料会員専用です。
        </h3>
        {user ? (
          /* ログイン済みだが有料会員ではない場合 */
          <>
            <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed">
              この機能をご利用いただくには、<br />
              有料会員登録（月額770円・税込）が必要です。
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  window.location.href = '/subscribe';
                }}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                会員登録
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="w-full text-gray-500 hover:text-gray-700"
              >
                閉じる
              </Button>
            </div>
          </>
        ) : (
          /* 未ログインの場合 */
          <>
            <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed">
              ご利用にはログインのうえ、<br />
              会員登録（月額770円・税込）が必要です。
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  window.location.href = '/login';
                }}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                ログイン
              </Button>
              <Button
                onClick={() => {
                  window.location.href = '/subscribe';
                }}
                className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
              >
                会員登録
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="w-full text-gray-500 hover:text-gray-700"
              >
                閉じる
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaidMemberRoute;
