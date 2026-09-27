import { errorMessage } from '../labels';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { fetchLikesWithProfiles, fetchMatches, unmatch, withdrawLike } from '../api/matching';
import { fetchUnreadCounts } from '../api/messages';
import ProfileCard, { Avatar } from '../components/ProfileCard';
import type { MatchWithPeer } from '../types';
import { LikeButton } from './DiscoveryPages';
import { useLikeAction, useRegionNames } from '../hooks';

export const LikesPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchLikesWithProfiles>> | null>(null);
  const { liked, like } = useLikeAction();
  const regionName = useRegionNames();

  const reload = () => {
    if (user) fetchLikesWithProfiles(user.id).then(setData).catch(() => setData({ sent: [], received: [] }));
  };
  useEffect(reload, [user]);

  const withdraw = async (toUserId: string) => {
    if (!user) return;
    await withdrawLike(user.id, toUserId);
    reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">いいね</h1>
      <Tabs defaultValue="received">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="received">もらった {data ? `(${data.received.length})` : ''}</TabsTrigger>
          <TabsTrigger value="sent">送った {data ? `(${data.sent.length})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="received">
          {data && data.received.length === 0 && <p className="text-center text-gray-500 py-10">まだいいねはありません</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data?.received.map(({ like: l, peer }) => (
              <ProfileCard
                key={l.id}
                profile={peer}
                regionName={regionName(peer.residence_region_id)}
                footer={<LikeButton profile={peer} liked={liked.has(peer.id ?? '')} onLike={like} />}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="sent">
          {data && data.sent.length === 0 && <p className="text-center text-gray-500 py-10">まだいいねを送っていません</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data?.sent.map(({ like: l, peer }) => (
              <ProfileCard
                key={l.id}
                profile={peer}
                regionName={regionName(peer.residence_region_id)}
                footer={<Button size="sm" variant="outline" className="w-full mt-1" onClick={() => withdraw(l.to_user_id)}>取り消す</Button>}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const MatchesPage: React.FC = () => {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<MatchWithPeer[] | null>(null);
  const [unread, setUnread] = useState<Map<string, number>>(new Map());

  const reload = () => {
    if (!user) return;
    fetchMatches(user.id).then(setItems).catch(() => setItems([]));
    fetchUnreadCounts(user.id).then(setUnread).catch(() => undefined);
  };
  useEffect(reload, [user]);

  const doUnmatch = async (m: MatchWithPeer) => {
    if (!window.confirm(`${m.peer?.nickname ?? ''} さんとのマッチを解除しますか？`)) return;
    try {
      await unmatch(m.match.id);
      toast({ title: 'マッチを解除しました' });
      reload();
    } catch (e) {
      toast({ title: '解除できませんでした', description: errorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">メッセージ</h1>
      {items === null && <p className="text-center text-gray-500 py-10">読み込み中…</p>}
      {items?.length === 0 && (
        <div className="text-center text-gray-500 py-10 space-y-1">
          <p>まだマッチはありません</p>
          <p className="text-sm">お互いに「いいね」するとメッセージを始められます</p>
        </div>
      )}
      <ul className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100">
        {items?.map((m) => {
          const count = m.conversation ? unread.get(m.conversation.id) ?? 0 : 0;
          return (
            <li key={m.match.id} className="flex items-center gap-3 p-3">
              <Link to={`/app/users/${m.peer?.id ?? ''}`} className="shrink-0">
                <Avatar path={m.peer?.primary_photo_path} name={m.peer?.nickname ?? null} className="w-14 h-14 rounded-full" />
              </Link>
              <Link to={m.conversation ? `/app/chat/${m.conversation.id}` : '#'} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{m.peer?.nickname ?? '(退会したユーザー)'}</span>
                  {count > 0 && <span className="bg-rose-600 text-white text-[10px] rounded-full px-1.5 py-0.5">{count}</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {m.conversation?.last_message_preview ?? 'マッチしました！メッセージを送ってみましょう'}
                </p>
              </Link>
              <Button variant="ghost" size="sm" className="text-gray-400 shrink-0" onClick={() => doUnmatch(m)}>解除</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
