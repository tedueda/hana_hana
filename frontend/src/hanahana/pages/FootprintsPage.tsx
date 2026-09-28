import React, { useEffect, useState } from 'react';
import { Footprints } from 'lucide-react';
import { fetchFootprints, fetchFootprintsSummary, type Footprint, type FootprintsSummary } from '../api/premium';
import { fetchPublicProfiles } from '../api/profile';
import ProfileCard from '../components/ProfileCard';
import PremiumLock from '../components/PremiumLock';
import { LikeButton } from './DiscoveryPages';
import { useLikeAction, useRegionNames } from '../hooks';
import { formatDate, useI18n } from '../i18n';
import type { PublicProfile } from '../types';
import { PageHeader } from './SettingsPage';
import MatchModal from '../components/MatchModal';

const FootprintsPage: React.FC = () => {
  const { t, locale } = useI18n();
  const regionName = useRegionNames();
  const { liked, like, matched, dismissMatch } = useLikeAction();
  const [summary, setSummary] = useState<FootprintsSummary | null>(null);
  const [rows, setRows] = useState<{ fp: Footprint; peer: PublicProfile }[] | null>(null);

  useEffect(() => {
    fetchFootprintsSummary().then(async (s) => {
      setSummary(s);
      if (!s.unlocked) return;
      const fps = await fetchFootprints();
      const profiles = await fetchPublicProfiles(fps.map((f) => f.viewer_id));
      setRows(fps.flatMap((fp) => { const peer = profiles.get(fp.viewer_id); return peer ? [{ fp, peer }] : []; }));
    }).catch(() => setSummary({ unlocked: false, days: 30, viewer_count: 0 }));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={t('footprints.title')} back="/app/profile" />
      {summary && (
        <p className="text-sm text-gray-700 bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-2">
          <Footprints className="w-4 h-4 text-rose-500 shrink-0" />
          {t('footprints.summary', { days: summary.days, n: summary.viewer_count })}
        </p>
      )}
      {summary && !summary.unlocked && <PremiumLock lead={t('footprints.lockedHint')} />}
      {summary?.unlocked && rows && rows.length === 0 && <p className="text-center text-gray-500 py-10">{t('footprints.empty')}</p>}
      {summary?.unlocked && rows && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map(({ fp, peer }) => (
            <ProfileCard
              key={fp.viewer_id}
              profile={peer}
              regionName={regionName(peer.residence_region_id)}
              footer={
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-500">{formatDate(fp.last_viewed_at, locale)} · {t('footprints.views', { n: Number(fp.view_count) })}</p>
                  <LikeButton profile={peer} liked={liked.has(peer.id ?? '')} onLike={like} />
                </div>
              }
            />
          ))}
        </div>
      )}
      <MatchModal match={matched} onClose={dismissMatch} />
    </div>
  );
};

export default FootprintsPage;
