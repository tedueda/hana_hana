import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Globe2, HeartHandshake, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '../auth/useSupabaseAuth';
import { APP_NAME } from '../labels';

const FEATURES = [
  { icon: Globe2, title: '日本人と韓国人が出会える', body: '国籍・居住地・年齢などの条件から、あなたに合う相手を探せます。' },
  { icon: HeartHandshake, title: '恋愛だけじゃない', body: '恋人探し・友達探し・日韓交流・旅行時の交流など、目的を選べます。' },
  { icon: Languages, title: '言語交換ができる', body: '韓国語を学びたい日本人と、日本語を学びたい韓国人をつなぎます。' },
  { icon: Sparkles, title: '趣味からつながる', body: 'K-POP・ドラマ・グルメ・旅行など、共通の趣味で会話が始まります。' },
  { icon: ShieldCheck, title: '安心して交流', body: '本人確認・ブロック・通報機能で、安全なコミュニティを守ります。' },
];

const LandingPage: React.FC = () => {
  const { session, isLoading } = useSupabaseAuth();
  if (!isLoading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-orange-50">
      <header className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-rose-600 text-lg">{APP_NAME}</span>
        <Button asChild variant="ghost" size="sm"><Link to="/app/login">ログイン</Link></Button>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12 space-y-14">
        <section className="text-center space-y-5">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-gray-900">
            日本と韓国をつなぐ、<br />新しい出会い。
          </h1>
          <p className="text-gray-600">恋愛・友達・言語交換・趣味。目的に合わせて、隣の国の誰かとつながろう。</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700"><Link to="/app/register">無料で始める</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/app/login">ログイン</Link></Button>
          </div>
        </section>
        <section className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-rose-100 p-5 flex gap-3">
              <Icon className="w-7 h-7 text-rose-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600 mt-1">{body}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="text-center text-sm text-gray-500">
          会員登録 → プロフィール作成 → おすすめ → いいね → マッチング → メッセージ
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
