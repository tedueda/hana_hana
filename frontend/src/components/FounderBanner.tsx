/**
 * STEP③: 創業メンバー募集バナー
 * 「創業メンバー募集（残り○名）」を表示
 * 200名に達したら「募集終了」を表示
 */
import React from 'react';
import { useFounderStatus } from '../hooks/useFounder';
import { Link } from 'react-router-dom';

const FounderBanner: React.FC = () => {
  const { status, loading } = useFounderStatus();

  if (loading || !status) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 text-center">
      {status.is_accepting ? (
        <Link to="/subscribe" className="hover:underline">
          <span className="font-bold text-lg">
            🌟 創業メンバー募集中（残り{status.remaining_slots}名）
          </span>
          <span className="ml-2 text-sm opacity-90">
            ― {status.limit}名限定の特別メンバーシップ
          </span>
        </Link>
      ) : (
        <span className="font-bold text-lg">
          創業メンバー募集は終了しました（{status.limit}名到達）
        </span>
      )}
    </div>
  );
};

export default FounderBanner;
