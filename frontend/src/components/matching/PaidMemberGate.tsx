import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaidMember } from '@/hooks/usePremium';
import { useAuth } from '@/contexts/AuthContext';
import MatchingGateModal from './MatchingGateModal';
import { API_URL } from '../../config';

interface PaidMemberGateProps {
  children: React.ReactNode;
}

/**
 * 有料会員限定コンテンツのゲートコンポーネント
 * 閲覧者（未ログイン）の場合はモーダルを表示し、コンテンツを薄く表示
 */
const PaidMemberGate: React.FC<PaidMemberGateProps> = ({ children }) => {
  const { isPaidUser, loading } = usePaidMember();
  const { isFreeUser } = useAuth();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/');
  };

  const handleUpgrade = async () => {
    try {
      // 有料会員登録へのリダイレクト
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (_) {}
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]">Loading...</div>;
  }

  // 閲覧者または会員でない場合はゲートを表示
  if (isFreeUser || !isPaidUser) {
    return (
      <>
        <MatchingGateModal open={true} onClose={handleClose} onUpgrade={handleUpgrade} />
        <div aria-hidden className="pointer-events-none select-none opacity-40">
          {children}
        </div>
      </>
    );
  }

  return <>{children}</>;
};

export default PaidMemberGate;

/** @deprecated PaidMemberGate を使用してください */
export { PaidMemberGate as PremiumGate };
