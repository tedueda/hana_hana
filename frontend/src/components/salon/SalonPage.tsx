import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Plus, MessageCircle, Grid3x3, List, ArrowLeft } from 'lucide-react';
import SalonRoomCard from './SalonRoomCard';
import CreateSalonRoomModal from './CreateSalonRoomModal';
import { API_URL } from '../../config';

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

const SalonPage: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<SalonRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const isLoggedIn = !!user;

  const fetchRooms = async () => {
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedRoomType) {
        params.append('room_type', selectedRoomType);
      }
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_URL}/api/salon/rooms?${params}`, {
        headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
      } else if (response.status === 403) {
        setError(t('salon.paidMemberOnly'));
      } else {
        setError(t('salon.fetchFailed'));
      }
    } catch (err) {
      setError(t('salon.networkError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [token, selectedRoomType]);

  const handleRoomCreated = () => {
    setShowCreateModal(false);
    fetchRooms();
  };

  const roomTypes = [
    { value: null, label: t('salon.roomTypes.all') },
    { value: 'consultation', label: t('salon.roomTypes.consultation') },
    { value: 'exchange', label: t('salon.roomTypes.exchange') },
    { value: 'story', label: t('salon.roomTypes.story') },
    { value: 'other', label: t('salon.roomTypes.other') },
  ];

  const handleRoomClick = (roomId: number) => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      navigate('/account');
      return;
    }
    navigate(`/salon/rooms/${roomId}`);
  };

  const handleNewPost = () => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    if (!isPaidUser) {
      navigate('/account');
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/feed')}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('salon.backToHome')}
          </Button>
          <Button
            onClick={handleNewPost}
            className="bg-black hover:bg-gray-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            新規投稿
          </Button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900">{t('salon.title')}</h1>
            <p className="text-gray-600 mt-1">{t('salon.subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {roomTypes.map((type) => (
              <Button
                key={type.value || 'all'}
                variant={selectedRoomType === type.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRoomType(type.value)}
                className={selectedRoomType === type.value ? 'bg-black' : ''}
              >
                {type.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-black' : ''}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-black' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('salon.loading')}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">{t('salon.noRoomsYet')}</p>
            <p className="text-gray-500 text-sm mt-2">{t('salon.createFirstRoom')}</p>
          </div>
        ) : viewMode === 'grid' ?(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <SalonRoomCard
                key={room.id}
                room={room}
                onClick={() => handleRoomClick(room.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <Card
                key={room.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleRoomClick(room.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                          {t(`salon.roomTypes.${room.room_type}`)}
                        </span>
                        {room.allow_anonymous && (
                          <span className="text-xs text-gray-500">{t('salon.anonymousAllowed')}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{room.theme}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {room.description}
                      </p>
                      <div className="mb-2">
                        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                          {t('salon.target')}: {room.target_identities?.includes('ALL') || !room.target_identities?.length ? t('salon.identities.ALL') : room.target_identities.map((id) => t(`salon.identities.${id}`, { defaultValue: id })).slice(0, 3).join(', ') + (room.target_identities.length > 3 ? '...' : '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {t('salon.participants', { count: room.participant_count })}
                        </span>
                        <span>{t('salon.creator')}: {room.creator_display_name || t('common.unknownUser')}</span>
                        <span>{new Date(room.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSalonRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleRoomCreated}
      />
    </div>
  );
};

export default SalonPage;
