import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronRight, Heart, LogOut, Pencil, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchAdminRole } from '../api/admin';
import { fetchMyVerification, fetchProfileDetails } from '../api/profile';
import type { VerificationStatus } from '../api/admin';
import { Avatar } from '../components/ProfileCard';
import { useI18n } from '../i18n';
import { useLabels, useRegionNames } from '../hooks';
import type { Profile, ProfilePhoto } from '../types';
import type { MessageKey } from '../i18n/ja';

function ageOf(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age -= 1;
  return age;
}

/** プロフィール完成度 (0-100) */
export function completeness(p: Profile, photoCount: number, langCount: number, purposeCount: number): number {
  const checks = [
    !!p.nickname,
    !!p.gender,
    !!p.birthdate,
    !!p.nationality,
    !!p.residence_country,
    photoCount > 0,
    langCount > 0,
    purposeCount > 0,
    !!p.bio,
    !!(p.pref_gender && p.pref_gender.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const VERIFY_KEY: Record<string, MessageKey> = {
  unverified: 'my.verify.unverified',
  pending: 'my.verify.pending',
  verified: 'my.verify.verified',
  rejected: 'my.verify.rejected',
};

const MyProfilePage: React.FC = () => {
  const { user, profile, signOut } = useSupabaseAuth();
  const { t } = useI18n();
  const labels = useLabels();
  const regionName = useRegionNames();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [counts, setCounts] = useState({ langs: 0, purposes: 0 });
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>('unverified');

  useEffect(() => {
    fetchAdminRole().then((r) => setIsAdmin(r !== null)).catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchProfileDetails(user.id)
      .then((d) => {
        setPhotos(d.photos);
        setCounts({ langs: d.languages.length, purposes: d.purposeIds.length });
      })
      .catch(() => undefined);
    fetchMyVerification()
      .then((v) => setVerifyStatus(v?.status ?? 'unverified'))
      .catch(() => undefined);
  }, [user]);

  const logout = async () => {
    await signOut();
    navigate('/app/login', { replace: true });
  };

  if (!profile) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>;

  const primary = photos.find((p) => p.is_primary) ?? photos[0];
  const pct = completeness(profile, photos.length, counts.langs, counts.purposes);
  const age = ageOf(profile.birthdate);
  const verifyKey = VERIFY_KEY[verifyStatus] ?? 'my.verify.unverified';
  const tierKey: MessageKey = profile.member_tier === 'paid' ? 'my.tier.paid' : profile.member_tier === 'invited' ? 'my.tier.invited' : 'my.tier.free';

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t('my.title')}</h1>

      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <Link to="/app/profile/edit" className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
            <Avatar path={primary?.storage_path} name={profile.nickname} className="w-20 h-20 rounded-full" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-semibold truncate">{profile.nickname ?? t('common.unset')}</span>
              {age !== null && <span className="text-gray-600">{age}</span>}
              {verifyStatus === 'verified' && <BadgeCheck className="w-5 h-5 text-sky-500" aria-label={t('profile.verified')} />}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
              {profile.nationality && <span>{labels.nationality[profile.nationality]}</span>}
              {profile.residence_country && (
                <span>
                  {labels.country[profile.residence_country]}
                  {regionName(profile.residence_region_id) ? ` / ${regionName(profile.residence_region_id)}` : ''}
                </span>
              )}
              <Badge variant="secondary">{t(tierKey)}</Badge>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>{t('my.completeness')}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" className="w-full mt-4 h-11">
          <Link to="/app/profile/edit"><Pencil className="w-4 h-4" />{t('my.editProfile')}</Link>
        </Button>
      </section>

      {!profile.onboarding_completed && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">{t('my.incomplete')}</p>
      )}
      {profile.onboarding_completed && photos.length === 0 && (
        <div className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3 flex items-center justify-between gap-3">
          <span>{t('my.noPhoto')}</span>
          <Button asChild size="sm" variant="outline"><Link to="/app/profile/edit">{t('my.addPhoto')}</Link></Button>
        </div>
      )}

      <nav className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        <MenuRow to="/app/profile/verification" icon={BadgeCheck} label={t('my.verification')} value={t(verifyKey)} />
        <MenuRow to="/app/profile/likes" icon={Heart} label={t('my.likes')} />
        <MenuRow to="/app/settings" icon={Settings} label={t('my.settings')} />
        <MenuRow to="/app/plus" icon={Sparkles} label={t('my.plus')} />
        {isAdmin && <MenuRow to="/app/admin" icon={ShieldCheck} label={t('my.admin')} />}
      </nav>

      <Button variant="ghost" className="w-full text-gray-500 h-11" onClick={logout}>
        <LogOut className="w-4 h-4" /> {t('my.logout')}
      </Button>
    </div>
  );
};

export const MenuRow: React.FC<{ to: string; icon: React.ElementType; label: string; value?: string; danger?: boolean }> = ({
  to,
  icon: Icon,
  label,
  value,
  danger,
}) => (
  <Link
    to={to}
    className={`flex items-center gap-3 px-4 min-h-[52px] text-sm hover:bg-gray-50 focus:outline-none focus-visible:bg-rose-50 ${danger ? 'text-red-600' : ''}`}
  >
    <Icon className={`w-5 h-5 ${danger ? 'text-red-500' : 'text-gray-500'}`} aria-hidden />
    <span className="flex-1">{label}</span>
    {value && <span className="text-xs text-gray-500">{value}</span>}
    <ChevronRight className="w-4 h-4 text-gray-300" aria-hidden />
  </Link>
);

export default MyProfilePage;
