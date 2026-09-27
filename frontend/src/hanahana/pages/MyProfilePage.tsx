import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, LogOut, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { GENDER_LABELS, MEETING_PREF_LABELS, NATIONALITY_LABELS } from '../labels';

const MyProfilePage: React.FC = () => {
  const { user, profile, signOut } = useSupabaseAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate('/app/login', { replace: true });
  };

  if (!profile) return <p className="text-center text-gray-500 py-10">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">プロフィール</h1>
        <Button asChild size="sm" variant="outline">
          <Link to="/app/profile/edit"><Pencil className="w-4 h-4" />編集</Link>
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{profile.nickname ?? '(未設定)'}</span>
          <Badge variant="secondary">{profile.member_tier === 'paid' ? '有料会員' : profile.member_tier === 'invited' ? '招待会員' : '無料会員'}</Badge>
        </div>
        <dl className="text-sm grid grid-cols-[6rem_1fr] gap-y-1.5 text-gray-700">
          <dt className="text-gray-500">メール</dt><dd className="truncate">{user?.email}</dd>
          <dt className="text-gray-500">性別</dt><dd>{profile.gender ? GENDER_LABELS[profile.gender] : '-'}</dd>
          <dt className="text-gray-500">国籍</dt><dd>{profile.nationality ? NATIONALITY_LABELS[profile.nationality] : '-'}</dd>
          <dt className="text-gray-500">居住国</dt><dd>{profile.residence_country ? NATIONALITY_LABELS[profile.residence_country] : '-'}</dd>
          <dt className="text-gray-500">職業</dt><dd>{profile.occupation ?? '-'}</dd>
          <dt className="text-gray-500">交流</dt><dd>{profile.meeting_pref ? MEETING_PREF_LABELS[profile.meeting_pref] : '-'}</dd>
        </dl>
        {profile.bio && <p className="text-sm whitespace-pre-wrap text-gray-800">{profile.bio}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <BadgeCheck className="w-5 h-5 text-sky-500" />
          <span>本人確認</span>
        </div>
        <span className="text-xs text-gray-500">準備中（なりすまし防止のため今後導入）</span>
      </div>

      {!profile.onboarding_completed && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">プロフィールが未完成です。おすすめ表示のために必須項目を入力してください。</p>
      )}

      <Button variant="ghost" className="w-full text-gray-500" onClick={logout}>
        <LogOut className="w-4 h-4" /> ログアウト
      </Button>
    </div>
  );
};

export default MyProfilePage;
