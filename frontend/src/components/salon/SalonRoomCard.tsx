import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../ui/card';
import { Users, MessageCircle, Lock, Unlock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { translateText } from '../../services/translationService';

interface SalonRoom {
  id: number;
  creator_id: number;
  theme: string;
  description: string;
  target_identities: string[];
  room_type: string;
  allow_anonymous: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  participant_count: number;
  creator_display_name: string | null;
}

interface SalonRoomCardProps {
  room: SalonRoom;
  onClick: () => void;
}

const SalonRoomCard: React.FC<SalonRoomCardProps> = ({ room, onClick }) => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [translatedTheme, setTranslatedTheme] = useState(room.theme);
  const [translatedDescription, setTranslatedDescription] = useState(room.description);

  useEffect(() => {
    const translateContent = async () => {
      if (currentLanguage === 'ja') {
        setTranslatedTheme(room.theme);
        setTranslatedDescription(room.description);
        return;
      }

      try {
        const [themeResult, descResult] = await Promise.all([
          translateText(room.theme, currentLanguage as any),
          translateText(room.description, currentLanguage as any)
        ]);
        setTranslatedTheme(themeResult.translated_text);
        setTranslatedDescription(descResult.translated_text);
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    translateContent();
  }, [room.theme, room.description, currentLanguage]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getIdentityLabels = (identities: string[]) => {
    if (!identities || identities.length === 0) {
      return t('salon.identities.ALL');
    }
    if (identities.includes('ALL')) {
      return t('salon.identities.ALL');
    }
    // Display Japanese category names directly (backend now returns Japanese values)
    return identities
      .slice(0, 3)
      .join(', ') + (identities.length > 3 ? '...' : '');
  };

  return (
    <Card
      className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {t(`salon.roomTypes.${room.room_type}`)}
          </span>
          <div className="flex items-center gap-1 text-gray-500">
            {room.allow_anonymous ? (
              <Unlock className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </div>
        </div>

        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-gray-700">
          {translatedTheme}
        </h3>

        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {translatedDescription}
        </p>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
            {t('salon.target')}: {getIdentityLabels(room.target_identities)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {t('salon.participants', { count: room.participant_count })}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
            </span>
          </div>
          <span className="text-xs">
            {formatDate(room.created_at)}
          </span>
        </div>

        {room.creator_display_name && (
          <div className="mt-2 text-xs text-gray-400">
            {t('salon.creator')}: {room.creator_display_name}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalonRoomCard;
