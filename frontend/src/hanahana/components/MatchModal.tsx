import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { useI18n } from '../i18n';
import type { NewMatch } from '../hooks';
import { fetchPublicProfile } from '../api/profile';
import type { PublicProfile } from '../types';
import { Avatar } from './ProfileCard';

const MatchModal: React.FC<{ match: NewMatch | null; onClose: () => void }> = ({ match, onClose }) => {
  const { t } = useI18n();
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<PublicProfile | null>(null);
  useEffect(() => {
    if (user && match) fetchPublicProfile(user.id).then(setMe).catch(() => undefined);
  }, [user, match]);
  if (!match) return null;
  const name = match.peer.nickname ?? t('profile.unnamed');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl text-center bg-gradient-to-b from-rose-50 to-white border-rose-100">
        <div className="flex items-center justify-center gap-2 pt-4">
          <Avatar path={me?.primary_photo_path} name={me?.nickname ?? null} className="w-24 h-24 rounded-full ring-4 ring-white shadow" />
          <Heart className="w-8 h-8 text-rose-500 fill-current -mx-3 relative z-10 drop-shadow" />
          <Avatar path={match.peer.primary_photo_path} name={match.peer.nickname} className="w-24 h-24 rounded-full ring-4 ring-white shadow" />
        </div>
        <DialogTitle className="text-2xl font-bold text-rose-600">{t('match.title')}</DialogTitle>
        <DialogDescription className="text-gray-600 break-words">
          {t(match.conversationId ? 'match.lead' : 'match.leadNoConv', { name })}
        </DialogDescription>
        <div className="space-y-2 pt-2">
          <Button
            className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-base"
            onClick={() => {
              onClose();
              navigate(match.conversationId ? `/app/chat/${match.conversationId}` : '/app/matches');
            }}
          >
            {t('matches.sendMessage')}
          </Button>
          <Button variant="ghost" className="w-full h-11" onClick={onClose}>
            {t('matches.later')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchModal;
