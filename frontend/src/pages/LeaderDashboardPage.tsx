/**
 * STEP③: リーダーダッシュボード（簡易）
 * - 紹介人数
 * - 有料会員数
 * - role=leader のみアクセス可能（一般ユーザーには表示しない）
 */
import React, { useEffect, useState } from 'react';
import { useAuth, resilientFetch } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface DashboardData {
  ref_code: string;
  total_referrals: number;
  paid_referrals: number;
}

const LeaderDashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchDashboard = async () => {
      try {
        const res = await resilientFetch('/api/founder/leader-dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json: DashboardData = await res.json();
          setData(json);
        } else if (res.status === 403) {
          setError('リーダー権限が必要です');
        } else {
          setError('データの取得に失敗しました');
        }
      } catch (e) {
        setError('通信エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token, navigate]);

  const handleCopyRefLink = () => {
    if (!data) return;
    const url = `${window.location.origin}/register?ref=${data.ref_code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-red-500 text-lg">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-pink-500 hover:underline"
        >
          戻る
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">リーダーダッシュボード</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">紹介人数</p>
          <p className="text-3xl font-bold text-pink-500">{data.total_referrals}</p>
          <p className="text-xs text-gray-400 mt-1">人</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">有料会員数</p>
          <p className="text-3xl font-bold text-green-500">{data.paid_referrals}</p>
          <p className="text-xs text-gray-400 mt-1">人</p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-3">紹介リンク</h2>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={`${window.location.origin}/register?ref=${data.ref_code}`}
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700"
          />
          <button
            onClick={handleCopyRefLink}
            className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition-colors whitespace-nowrap"
          >
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          紹介コード: {data.ref_code} ・ 報酬期間: 12ヶ月
        </p>
      </div>

      {/* Info */}
      <div className="mt-6 text-sm text-gray-500">
        <p>※ 有料会員化したユーザーのみが報酬対象です</p>
        <p>※ 紹介コードは登録時に固定され、変更不可です</p>
      </div>
    </div>
  );
};

export default LeaderDashboardPage;
