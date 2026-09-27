import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { fetchAdminStats, type AdminStats } from '../api/admin';
import { Empty, PageHeader } from './common';
import { errorMessage } from './labels';

const Stat: React.FC<{ label: string; value: number | undefined; to?: string; accent?: boolean }> = ({ label, value, to, accent }) => {
  const body = (
    <Card className={accent && value ? 'border-red-300 bg-red-50' : ''}>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-1">{value ?? '-'}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStats().then(setStats).catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) return <Empty text={`統計の取得に失敗しました: ${error}`} />;

  return (
    <div>
      <PageHeader title="ダッシュボード" />
      <h2 className="text-sm font-semibold text-gray-600 mb-2">要対応</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="未対応の通報" value={stats?.reports_open} to="/app/admin/reports" accent />
        <Stat label="本人確認 審査待ち" value={stats?.verifications_pending} to="/app/admin/verifications" accent />
        <Stat label="利用停止中" value={stats?.users_suspended} to="/app/admin/users?status=suspended" />
        <Stat label="BAN" value={stats?.users_banned} to="/app/admin/users?status=banned" />
      </div>
      <h2 className="text-sm font-semibold text-gray-600 mb-2">会員</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="総会員数" value={stats?.users_total} to="/app/admin/users" />
        <Stat label="有効会員" value={stats?.users_active} />
        <Stat label="日本" value={stats?.users_jp} to="/app/admin/users?nationality=JP" />
        <Stat label="韓国" value={stats?.users_kr} to="/app/admin/users?nationality=KR" />
        <Stat label="有料会員" value={stats?.users_paid} />
        <Stat label="新規登録 (7日)" value={stats?.users_new_7d} />
        <Stat label="アクティブ (24h)" value={stats?.active_24h} />
      </div>
      <h2 className="text-sm font-semibold text-gray-600 mb-2">マッチング</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="いいね総数" value={stats?.likes_total} />
        <Stat label="マッチ (有効)" value={stats?.matches_active} />
        <Stat label="マッチ (累計)" value={stats?.matches_total} />
        <Stat label="メッセージ (24h)" value={stats?.messages_24h} />
        <Stat label="メッセージ (累計)" value={stats?.messages_total} />
      </div>
    </div>
  );
};

export default DashboardPage;
