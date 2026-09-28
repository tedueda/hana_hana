import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Ban, Flag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { recordProfileView } from '../api/premium';
import CompatibilityCard from '../components/CompatibilityCard';
import { loadMasterData, localizedName, type MasterData } from '../api/master';
import { blockUser, reportUser } from '../api/matching';
import { fetchProfileDetails, fetchPublicProfile, type ProfileDetails } from '../api/profile';
import { Avatar } from '../components/ProfileCard';
import MatchModal from '../components/MatchModal';
import { REPORT_REASONS } from '../labels';
import type { PublicProfile, ReportReason, UiLang } from '../types';
import { LikeButton } from './DiscoveryPages';
import { useLabels, useLikeAction } from '../hooks';
import { useI18n } from '../i18n';

const UserProfilePage: React.FC = () => {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const { t, lang: uiLang } = useI18n();
  const lang = uiLang as UiLang;
  const L = useLabels();
  const { toast } = useToast();
  const { liked, like, matched, dismissMatch } = useLikeAction();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [details, setDetails] = useState<ProfileDetails | null>(null);
  const [master, setMaster] = useState<MasterData | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('inappropriate_content');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    loadMasterData().then(setMaster).catch(() => undefined);
    fetchPublicProfile(userId).then(setProfile).catch(() => setProfile(null));
    fetchProfileDetails(userId).then(setDetails).catch(() => undefined);
    if (user && user.id !== userId) void recordProfileView(userId);
  }, [userId, user]);

  if (profile === undefined) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>;
  if (!profile) return <p className="text-center text-gray-500 py-10">{t('profile.notAvailable')}</p>;

  const region = master?.regions.find((r) => r.id === profile.residence_region_id);
  const natives = details?.languages.filter((l) => l.role === 'native') ?? [];
  const learning = details?.languages.filter((l) => l.role === 'learning') ?? [];
  const hiddenPhotos = details ? details.photoTotal - details.photos.length : 0;

  const doBlock = async () => {
    if (!user || !window.confirm(t('profile.blockConfirm'))) return;
    await blockUser(user.id, userId);
    toast({ title: t('profile.blocked') });
    navigate('/app', { replace: true });
  };

  const doReport = async () => {
    if (!user) return;
    await reportUser(user.id, userId, reason, detail || undefined);
    setReportOpen(false);
    toast({ title: t('profile.reported'), description: t('profile.reportedLead') });
  };

  return (
    <div className="space-y-4 -mt-2">
      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {(details?.photos.length ? details.photos : [null]).map((p, i) => (
            <Avatar key={p?.id ?? i} path={p?.storage_path ?? profile.primary_photo_path} name={profile.nickname} className="w-full aspect-square" />
          ))}
          {hiddenPhotos > 0 && (
            <Link to="/app/plans" className="w-full aspect-square bg-gray-100 flex flex-col items-center justify-center gap-1 text-gray-600 text-xs p-3 text-center" data-testid="photos-locked">
              <Lock className="w-6 h-6 text-gray-400" />
              <span className="font-semibold">{t('profile.photosLocked', { n: hiddenPhotos })}</span>
              <span className="text-rose-600 underline">{t('premium.viewPlans')}</span>
            </Link>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold break-all">{profile.nickname ?? t('profile.unnamed')}</h1>
            {profile.age != null && <span className="text-gray-500">{profile.age}</span>}
            {profile.is_verified && (
              <Badge variant="outline" className="text-sky-600 border-sky-200 gap-1"><BadgeCheck className="w-3.5 h-3.5" />{t('profile.verified')}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            {profile.gender && <span>{L.gender[profile.gender]}</span>}
            {profile.nationality && <span>{t('profile.nationality')}: {L.nationality[profile.nationality]}</span>}
            {profile.residence_country && <span>{t('profile.residence')}: {L.country[profile.residence_country]}{region ? ` / ${localizedName(region, lang)}` : ''}</span>}
            {profile.occupation && <span>{profile.occupation}</span>}
          </div>
          {profile.bio && <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed break-words">{profile.bio}</p>}

          {master && details && (
            <div className="space-y-2 text-sm">
              {natives.length > 0 && (
                <p><span className="text-gray-500">{t('profile.native')}:</span> {natives.map((l) => localizedName(master.languages.find((x) => x.code === l.language_code), lang)).join(', ')}</p>
              )}
              {learning.length > 0 && (
                <p><span className="text-gray-500">{t('profile.learning')}:</span> {learning.map((l) => `${localizedName(master.languages.find((x) => x.code === l.language_code), lang)}（${L.level[l.level]}）`).join(', ')}</p>
              )}
              {details.purposeIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {details.purposeIds.map((id) => <Badge key={id} className="bg-rose-100 text-rose-700 hover:bg-rose-100">{localizedName(master.purposes.find((p) => p.id === id), lang)}</Badge>)}
                </div>
              )}
              {details.interestIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {details.interestIds.map((id) => <Badge key={id} variant="secondary">{localizedName(master.interests.find((p) => p.id === id), lang)}</Badge>)}
                </div>
              )}
              {profile.meeting_pref && <p><span className="text-gray-500">{t('profile.meeting')}:</span> {L.meetingPref[profile.meeting_pref]}</p>}
            </div>
          )}

          {user?.id !== userId && <CompatibilityCard targetUserId={userId} />}

          {user?.id !== userId && (
            <>
              <LikeButton profile={profile} liked={liked.has(userId)} onLike={like} />
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => setReportOpen(true)}><Flag className="w-4 h-4" />{t('profile.report')}</Button>
                <Button variant="ghost" size="sm" className="text-gray-500" onClick={doBlock}><Ban className="w-4 h-4" />{t('profile.block')}</Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('profile.reportTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {REPORT_REASONS.map((r) => (
                <Button key={r} type="button" size="sm" variant={reason === r ? 'default' : 'outline'} onClick={() => setReason(r)}>{L.reportReason[r]}</Button>
              ))}
            </div>
            <Textarea placeholder={t('profile.reportDetail')} value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
            <Button className="w-full" variant="destructive" onClick={doReport}>{t('common.send')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <MatchModal match={matched} onClose={dismissMatch} />
    </div>
  );
};

export default UserProfilePage;
