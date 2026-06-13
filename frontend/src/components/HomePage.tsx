import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe, LayoutGrid, List } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import UnderConstructionModal from './UnderConstructionModal';
import PremiumUpgradeModal from './PremiumUpgradeModal';
import { Post, User } from '../types/Post';
import { extractYouTubeId, extractYouTubeUrl } from '../utils/youtube';
import HeroAudioPlayer from './HeroAudioPlayer';
import liveWeddingBanner from '../assets/images/LiveWedding.png';
import { API_URL } from '../config';
import { detectExternalEmbed } from '../utils/embedExtractors';
import OgpThumbnail from './common/OgpThumbnail';
import PopularSalons from './salon/PopularSalons';
import MemberExchangeSection from './home/MemberExchangeSection';
import PopularBusiness from './home/PopularBusiness';

const boardCategories = [
  { key: "music", title: "ミュージック", desc: "あなたの好きな楽曲、作成した楽曲を投稿して共有しましょう！", emoji: "🎵", link: "/category/music" },
  { key: "art", title: "アート・動画", desc: "イラスト・写真・映像作品を発表して、アートの世界を広げましょう！", emoji: "🎨", link: "/category/art" },
  { key: "comics", title: "サブカルチャー", desc: "映画・アニメ・ゲーム・小説などの作品レビューと感想を共有しましょう！", emoji: "🎭", link: "/category/comics" },
  { key: "food_shops", title: "食レポ・お店", desc: "美味しいグルメやLGBTQフレンドリーなお店を紹介しましょう！", emoji: "🍽️", link: "/category/food", categories: ["food", "shops"] },
  { key: "tourism", title: "ツーリズム", desc: "おすすめの旅行先や観光スポットを紹介して、旅の楽しさを共有しましょう！", emoji: "📍", link: "/category/tourism" },
  { key: "board", title: "掲示板", desc: "悩み相談や雑談、日常の話題を自由に投稿しましょう！", emoji: "💬", link: "/category/board" },
];

// heroMessages are now loaded from i18n locale files

const getCategoryPlaceholder= (category: string | undefined): string => {
  const categoryMap: { [key: string]: string } = {
    'board': '/images/hero-slide-4.jpg',
    'community': '/images/hero-slide-4.jpg',
    'art': '/images/sub_cuture02.jpg',
    'music': '/images/music01.jpg',
    'shops': '/images/shop01.jpg',
    'tourism': '/images/img13.jpg',
    'comics': '/images/sub_cuture01.jpg',
  };
  return categoryMap[category || 'board'] || '/images/hero-slide-4.jpg';
};

// ニュース記事はAPIから取得

const dummyPosts: Post[] = [
  {
    id: 1,
    title: "初めての投稿です！",
    body: "こんにちは！Caratに参加しました。温かいコミュニティで素敵な出会いがありそうです。よろしくお願いします。",
    user_id: 1,
    visibility: "public",
    created_at: "2024-09-15T10:30:00Z",
    category: "board"
  },
  {
    id: 2,
    title: "おすすめのLGBTQ+楽曲",
    body: "最近聴いているアーティストの楽曲がとても心に響きます。同じような音楽が好きな方と語り合いたいです。",
    user_id: 3,
    visibility: "public",
    created_at: "2024-09-13T20:15:00Z",
    category: "music"
  },
  {
    id: 4,
    title: "新宿のLGBTQフレンドリーカフェ",
    body: "新宿二丁目にある素敵なカフェを見つけました。スタッフの方々がとても親切で、居心地の良い空間でした。",
    user_id: 4,
    visibility: "public",
    created_at: "2024-09-12T12:00:00Z",
    category: "shops"
  },
  {
    id: 5,
    title: "東京レインボープライドツアー企画",
    body: "来年のプライドイベントに向けて、みんなで一緒に参加するツアーを企画しています。興味のある方はぜひご参加ください。",
    user_id: 5,
    visibility: "public",
    created_at: "2024-09-11T18:30:00Z",
    category: "tourism"
  },
  {
    id: 6,
    title: "「君の名は。」のLGBTQ+解釈について",
    body: "新海誠監督の作品にはジェンダーアイデンティティのテーマが含まれていると思います。皆さんはどう思われますか？",
    user_id: 6,
    visibility: "public",
    created_at: "2024-09-10T14:20:00Z",
    category: "comics"
  }
];

const dummyUsers: { [key: number]: User } = {
  1: { id: 1, display_name: "さくら", email: "sakura@example.com" },
  2: { id: 2, display_name: "アート太郎", email: "art@example.com" },
  3: { id: 3, display_name: "音楽好き", email: "music@example.com" },
  4: { id: 4, display_name: "カフェ探検家", email: "cafe@example.com" },
  5: { id: 5, display_name: "ツアーガイド", email: "tour@example.com" },
  6: { id: 6, display_name: "映画評論家", email: "movie@example.com" }
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [, setPosts] = useState<Post[]>([]);
  const [categoryPosts, setCategoryPosts] = useState<{ [key: string]: Post[] }>({});
  const [translatedPosts, setTranslatedPosts] = useState<{ [key: number]: boolean }>({});
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [latestBlogs, setLatestBlogs] = useState<any[]>([]);
  const [, setUsers] = useState<{ [key: number]: User }>(dummyUsers);
  const [loading, setLoading] = useState(false);
  const [showConstructionModal, setShowConstructionModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [boardViewMode, setBoardViewMode] = useState<'card' | 'list'>('list');
  const [upgradeFeatureName] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const heroSectionRef = useRef<HTMLElement>(null);
  const { token, user, isAnonymous } = useAuth();
  const navigate = useNavigate();

  const fetchNews = async (lang?: string) => {
    try {
      const targetLang = lang || currentLanguage;
      const headers: any = {};
      if (token && !isAnonymous) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 翻訳エンドポイントを使用してニュースを取得
      console.log(`Fetching news from: ${API_URL}/api/translations/posts?category=news&limit=4&lang=${targetLang}`);
      const response = await fetch(`${API_URL}/api/translations/posts?category=news&limit=4&lang=${targetLang}`, { headers });
      console.log('News Response status:', response.status);
      if (response.ok) {
        const newsData = await response.json();
        console.log('📰 [HomePage] News articles fetched:', newsData.length, newsData);
        setNewsArticles(newsData);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    }
  };

  const fetchCategoryPosts = async (lang?: string) => {
    try {
      const headers: any = {};
      if (token && !isAnonymous) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const targetLang = lang || currentLanguage;
      
      // 並列処理で全カテゴリのデータを同時取得（翻訳エンドポイント使用）
      const categoryPromises = boardCategories.map(async (cat) => {
        if (cat.categories) {
          // 複数カテゴリを統合（食レポ・お店）
          const subCatPromises = cat.categories.map(subCat =>
            fetch(`${API_URL}/api/translations/posts?category=${subCat}&limit=8&lang=${targetLang}`, { headers })
              .then(res => res.ok ? res.json() : [])
              .catch(() => [])
          );
          const results = await Promise.all(subCatPromises);
          const combinedPosts = results.flat();
          // 最新順でソートして4件取得
          combinedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return { key: cat.key, posts: combinedPosts.slice(0, 4) };
        } else {
          // 単一カテゴリ（翻訳エンドポイント使用）
          const posts = await fetch(`${API_URL}/api/translations/posts?category=${cat.key}&limit=4&lang=${targetLang}`, { headers })
            .then(res => res.ok ? res.json() : [])
            .catch(() => []);
          return { key: cat.key, posts };
        }
      });
      
      const results = await Promise.all(categoryPromises);
      const allCategoryPosts: { [key: string]: Post[] } = {};
      results.forEach(result => {
        allCategoryPosts[result.key] = result.posts;
      });
      
      setCategoryPosts(allCategoryPosts);
    } catch (error) {
      console.error('Failed to fetch category posts:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const headers: any = {};
      if (token && !isAnonymous) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log(`Fetching posts from: ${API_URL}/api/posts?limit=20`);
      const response = await fetch(`${API_URL}/api/posts?limit=20`, {
        headers,
      });
      console.log('Response status:', response.status);

      if (response.ok) {
        const postsData = await response.json();
        
        const enhancedPosts = postsData.map((post: any) => ({
          ...post,
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          is_liked: post.is_liked || false,
        }));
        
        setPosts(enhancedPosts);
        
        const userIds = [...new Set(enhancedPosts.map((post: any) => post.user_id))];
        const usersData: { [key: number]: any } = {};
        
        for (const userId of userIds) {
          try {
            const userHeaders: any = {};
            if (token && !isAnonymous) {
              userHeaders['Authorization'] = `Bearer ${token}`;
            }
            
            const userResponse = await fetch(`${API_URL}/api/users/${userId}`, {
              headers: userHeaders,
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              usersData[userId as number] = userData;
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            usersData[userId as number] = {
              id: userId,
              display_name: `ユーザー${userId}`,
              email: `user${userId}@example.com`
            };
          }
        }
        
        setUsers(usersData);
        
        // 投稿にユーザー表示名を追加
        const postsWithUserNames = enhancedPosts.map((post: any) => ({
          ...post,
          user_display_name: usersData[post.user_id]?.display_name || 'テッドさん'
        }));
        setPosts(postsWithUserNames);
      } else {
        console.error('Failed to fetch posts from API, using fallback data');
        setPosts(dummyPosts);
        setUsers(dummyUsers);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setPosts(dummyPosts);
      setUsers(dummyUsers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set canonical URL for homepage
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://carat-community.com/';

    fetchPosts();
    fetchNews();
    fetchCategoryPosts(currentLanguage);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/blog?lang=ja&limit=6`);
        if (res.ok) setLatestBlogs(await res.json());
      } catch (e) { /* ignore */ }
    })();
  }, [user, isAnonymous]);

  // Re-fetch category posts and news when language changes
  useEffect(() => {
    // Set canonical URL for homepage
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://carat-community.com/';

    fetchPosts();
    fetchCategoryPosts(currentLanguage);
    fetchNews(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    // Set canonical URL for homepage
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://carat-community.com/';

    fetchPosts();
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 5);
    }, 8000);

    return () => clearInterval(slideInterval);
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="text-center text-gray-600">{t('homepage.loadingContent')}</div>
      </div>
    );
  }

  // メンテナンスモード: トップページリニューアル中
  const MAINTENANCE_MODE = false;
  if (MAINTENANCE_MODE) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 px-4">
        <div className="text-center max-w-lg">
          <div className="text-6xl mb-6">🔧</div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-4">
            メンテナンス中
          </h1>
          <p className="text-gray-600 mb-2 leading-relaxed">
            現在、トップページをリニューアル中です。
          </p>
          <p className="text-gray-500 text-sm mb-8">
            しばらくお待ちください。他のページは通常通りご利用いただけます。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/matching')}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              会員交流へ
            </button>
            <button
              onClick={() => navigate('/salon')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              サロンへ
            </button>
            <button
              onClick={() => navigate('/about')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Caratとは
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{
      background: `
        radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.8) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(240, 248, 255, 0.6) 0%, transparent 50%),
        radial-gradient(circle at 40% 80%, rgba(248, 250, 252, 0.7) 0%, transparent 50%),
        linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 50%, rgba(241, 245, 249, 0.9) 100%)
      `
    }}>
      <div className="w-full max-w-full space-y-8">
        
        {/* ヒーローセクション */}
        <section ref={heroSectionRef} className="relative w-full overflow-hidden" style={{height: '860px'}}>
          <div className="absolute inset-0">
            {[
              { desktop: '/images/hero5.png', mobile: '/images/m01.png' },
              { desktop: '/images/hero1.png', mobile: '/images/m02.png' },
              { desktop: '/images/img14.jpg', mobile: '/images/m03.png' },
              { desktop: '/images/hero2.png', mobile: '/images/m04.png' },
              { desktop: '/images/img10.jpg', mobile: '/images/m05.png' },
            ].map((slide, idx) => (
              <div
                key={idx}
                className={`absolute inset-0 transition-opacity duration-[3000ms] ease-in-out ${currentSlide === idx ? 'opacity-100' : 'opacity-0'}`}
              >
                <img
                  src={slide.desktop}
                  alt={`LGBTQ+ Community ${idx + 1}`}
                  className="hidden md:block w-full h-full object-cover"
                />
                <img
                  src={slide.mobile}
                  alt={`LGBTQ+ Community ${idx + 1}`}
                  className="block md:hidden w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-black bg-opacity-25"></div>
          {/* Sound Credit and Audio Player */}
          <div className="absolute bottom-1/4 md:bottom-16 right-8 z-50 flex flex-col items-end gap-2 pointer-events-auto">
            <div className="text-white text-sm opacity-70 flex items-center gap-2">
              <span className="text-lg">♫</span>
              <span>Inspired by Marvin Gaye</span>
            </div>
            <HeroAudioPlayer />
          </div>
          <div className="relative z-10 flex items-center justify-center h-full">
            <div className="text-center text-white px-4 max-w-6xl">
              <h2 key={`main-${currentSlide}`} className="text-4xl md:text-6xl font-serif font-bold leading-tight mb-6 transition-opacity duration-[3000ms] ease-in-out">
                {t(`hero.messages.${currentSlide}.main`).split('\n').map((line: string, i: number) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < t(`hero.messages.${currentSlide}.main`).split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))}
              </h2>
              {t(`hero.messages.${currentSlide}.sub`) && (
                <p key={`sub-${currentSlide}`} className="text-base md:text-xl mb-8 opacity-90 transition-opacity duration-[3000ms] ease-in-out">
                  {t(`hero.messages.${currentSlide}.sub`).split('\n').map((line: string, i: number) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < t(`hero.messages.${currentSlide}.sub`).split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ヒーロー直下のCTAセクション */}
        <section className="relative -mt-12 z-20">
          <div className="max-w-3xl mx-auto px-4">
            <div
              onClick={() => navigate('/about')}
              className="cursor-pointer rounded-2xl p-[2px] transition-all hover:scale-[1.01]"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #C5A028, #E8C84A, #D4AF37)',
                boxShadow: '0 10px 40px rgba(212, 175, 55, 0.3), 0 4px 16px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div className="bg-white rounded-[14px] px-6 py-6 md:px-10 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="text-left">
                  <p className="text-xl md:text-2xl font-serif font-bold text-slate-900">{t('cta.lgbtqCommunity')}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="w-full bg-black text-white px-6 py-3 text-base md:text-lg font-medium rounded-md text-center shadow-md">
                    {t('cta.aboutCarat')}
                  </div>
                  <div className="w-full text-gray-600 px-6 py-2 text-sm md:text-base text-center">
                    {t('cta.monthlyFee')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ===== 2カラムレイアウト開始（ヒーロー以下） ===== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* 左カラム（メインコンテンツ） */}
            <div className="flex-1 min-w-0">

        {/* 会員交流セクション */}
        <MemberExchangeSection />

        {/* 人気のサロン */}
        <PopularSalons />

        {/* 人気のビジネス */}
        <PopularBusiness />

        {/* 掲示板セクション */}
        <section className="py-8">
          {/* セクションヘッダー＋切り替えボタン */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-slate-900">掲示板</h2>
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-0.5">
              <button
                onClick={() => setBoardViewMode('card')}
                className={`p-2 rounded-md transition-colors ${boardViewMode === 'card' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                title="カード表示"
                aria-label="カード表示"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setBoardViewMode('list')}
                className={`p-2 rounded-md transition-colors ${boardViewMode === 'list' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                title="リスト表示"
                aria-label="リスト表示"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="space-y-10">
              {boardCategories.map((cat) => {
                const posts = (categoryPosts[cat.key] || []).slice(0, 4);
                const getImageUrl = (post: any) => {
                  const youtubeUrl = post.youtube_url || extractYouTubeUrl(post.body || '');
                  if (youtubeUrl) return `https://i.ytimg.com/vi/${extractYouTubeId(youtubeUrl)}/mqdefault.jpg`;
                  const url = post.media_url || (post.media_urls && post.media_urls[0]);
                  if (!url || typeof url !== 'string') return null;
                  return url.startsWith('http') ? url : (url.startsWith('/assets/') || url.startsWith('/images/')) ? url : `${API_URL}${url}`;
                };
                const formatDate = (d: string) => {
                  const dt = new Date(d);
                  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
                };
                return (
                  <div key={cat.key}>
                    {/* カテゴリヘッダー */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-gray-800 rounded-full flex-shrink-0" />
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <span className="text-2xl leading-none">{cat.emoji}</span>
                          {t(`homepage.categories.${cat.key}.title`)}
                        </h3>
                      </div>
                      <button
                        onClick={() => navigate(cat.link)}
                        className="text-xs text-gray-500 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-800 hover:text-white hover:border-gray-800 transition-all"
                      >
                        もっと見る →
                      </button>
                    </div>

                    {posts.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">投稿がまだありません</p>
                    ) : boardViewMode === 'card' ? (
                      /* カード表示（4列） */
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {posts.map((post) => {
                          const imageUrl = getImageUrl(post);
                          const bodyText = (post.body || '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 80);
                          return (
                            <Card
                              key={post.id}
                              className="group cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden"
                              onClick={() => navigate(`/posts/${post.id}`)}
                            >
                              <div className="h-24 overflow-hidden bg-gray-100">
                                <img
                                  src={imageUrl || getCategoryPlaceholder(post.category)}
                                  alt={post.title || '投稿'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { (e.target as HTMLImageElement).src = getCategoryPlaceholder(post.category); }}
                                />
                              </div>
                              <CardContent className="p-2 space-y-0.5">
                                <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-gray-600">
                                  {post.display_title || post.title}
                                </h4>
                                {bodyText && (
                                  <p className="text-[10px] text-gray-500 line-clamp-2">{bodyText}</p>
                                )}
                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                                  <span>{post.created_at ? formatDate(post.created_at) : ''}</span>
                                  <div className="flex gap-1">
                                    <span>◇{(post as any).carat_count ?? 0}</span>
                                    <span>○{(post as any).comment_count ?? 0}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      /* リスト表示 */
                      <div className="flex flex-col divide-y divide-gray-100">
                        {posts.map((post) => {
                          const imageUrl = getImageUrl(post);
                          const bodyText = (post.body || '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 80);
                          return (
                            <div
                              key={post.id}
                              className="group flex gap-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors px-1"
                              onClick={() => navigate(`/posts/${post.id}`)}
                            >
                              <div className="flex-shrink-0 w-28 h-20 overflow-hidden rounded-md bg-gray-100">
                                <img
                                  src={imageUrl || getCategoryPlaceholder(post.category)}
                                  alt={post.title || '投稿'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { (e.target as HTMLImageElement).src = getCategoryPlaceholder(post.category); }}
                                />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <div className="space-y-1">
                                  <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-gray-600">
                                    {post.display_title || post.title}
                                  </h4>
                                  {bodyText && (
                                    <p className="text-xs text-gray-500 line-clamp-2 hidden md:block">{bodyText}</p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-gray-400">{post.created_at ? formatDate(post.created_at) : ''}</span>
                                  <div className="flex gap-3 text-xs text-gray-400">
                                    <span>◇ {(post as any).carat_count ?? 0} カラット</span>
                                    <span>○ {(post as any).comment_count ?? 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ライブウェディングバナー */}
        <section className="py-6">
          <div className="relative shadow-2xl aspect-[4/3] md:aspect-[21/9]">
            <img
              src={liveWeddingBanner}
              alt={t('liveWedding.banner.bannerAlt')}
              className="absolute inset-0 w-full h-full object-cover block"
            />
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-4 md:px-16">
              <h2 className="text-2xl md:text-5xl font-serif font-bold text-white mb-2 md:mb-4">
                {t('liveWedding.banner.title')}
              </h2>
              <p className="text-sm md:text-2xl text-white/90 mb-4 md:mb-6 max-w-2xl">
                {t('liveWedding.banner.subtitle')}
              </p>
              <button
                onClick={() => {
                  navigate('/live-wedding');
                  window.scrollTo(0, 0);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 md:px-8 md:py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl text-sm md:text-base"
              >
                {t('liveWedding.banner.viewDetails')}
                <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
          </div>
        </section>

        {/* ニュースセクション */}
        <section className="py-12">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-6 gap-1 md:gap-0">
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">{t('news.title')}</h3>
            <Button 
              variant="ghost" 
              className="text-gray-600 hover:text-black hover:bg-gray-100 font-medium text-base self-start md:self-auto"
              onClick={() => navigate('/news')}
            >
              {t('news.viewAll')}
            </Button>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {newsArticles.slice(0, 4).map((article) => (
              <Card 
                key={article.id} 
                className="group bg-white border border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden rounded-lg"
                onClick={() => navigate(`/posts/${article.id}`)}
              >
                <div className="flex flex-row md:flex-col">
                {(article.media_url || (article.media_urls && article.media_urls.length > 0)) ? (
                  <div className="w-32 h-20 md:w-full md:h-[200px] flex-shrink-0 overflow-hidden rounded-l-lg md:rounded-l-none md:rounded-t-lg bg-gray-50">
                    <img
                      src={`${(() => {
                        const imageUrl = article.media_url || (article.media_urls && article.media_urls[0]);
                        if (!imageUrl || typeof imageUrl !== 'string') return '';
                        return imageUrl.startsWith('http') ? imageUrl : 
                               (imageUrl.startsWith('/assets/') || imageUrl.startsWith('/images/')) ? imageUrl : 
                               `${API_URL}${imageUrl}`;
                      })()}`}
                      alt={article.title || 'ニュース画像'}
                      className="w-full h-full object-contain md:object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (() => {
                  const externalEmbed = detectExternalEmbed(article.body || '');
                  if (externalEmbed) {
                    return (
                      <OgpThumbnail
                        url={externalEmbed.originalUrl}
                        alt={article.title || (externalEmbed.type === 'standfm' ? 'stand.fm' : 'Suno AI')}
                        className="w-32 h-20 md:w-full md:h-[200px] flex-shrink-0 overflow-hidden rounded-l-lg md:rounded-l-none md:rounded-t-lg bg-gray-100 flex items-center justify-center"
                        imgClassName="w-full h-full object-cover"
                        fallback={
                          <div className="w-32 h-20 md:w-full md:h-[200px] flex-shrink-0 overflow-hidden rounded-l-lg md:rounded-l-none md:rounded-t-lg bg-gradient-to-br from-purple-100 to-pink-100 flex flex-col items-center justify-center gap-1">
                            <div className="text-3xl">{externalEmbed.type === 'standfm' ? '🎙️' : '🎵'}</div>
                            <span className="text-xs font-medium text-gray-600">{externalEmbed.type === 'standfm' ? 'stand.fm' : 'Suno AI'}</span>
                          </div>
                        }
                      />
                    );
                  }
                  return (
                    <div className="w-32 h-20 md:w-full md:h-[200px] flex-shrink-0 overflow-hidden rounded-l-lg md:rounded-l-none md:rounded-t-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <span className="text-6xl opacity-30">📰</span>
                    </div>
                  );
                })()}
                <CardContent className="p-2 md:p-5 flex-1">
                  <div className="hidden md:flex items-center gap-2 mb-3">
                    <span className="text-xs bg-gray-800 text-white px-2.5 py-1 rounded font-medium">
                      news
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm md:text-lg font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-gray-700 transition-colors flex-1">
                      {article.display_title || article.title}
                    </h4>
                    {article.original_lang && article.original_lang !== currentLanguage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTranslatedPosts(prev => ({
                            ...prev,
                            [article.id]: !prev[article.id]
                          }));
                        }}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                        title={translatedPosts[article.id] ? t('common.showOriginal', '原文') : t('common.showTranslation', '翻訳')}
                      >
                        <Globe className={`h-4 w-4 ${translatedPosts[article.id] ? 'text-blue-600' : 'text-gray-400'}`} />
                      </button>
                    )}
                  </div>
                  <p className="hidden md:block text-sm text-slate-600 mb-4 leading-relaxed overflow-hidden">
                    {(article.display_text || article.body || '').replace(/\n+/g, ' ').slice(0, 50)}
                  </p>
                  <div className="hidden md:flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-gray-100">
                    <span>{new Date(article.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}</span>
                    <span className="text-gray-700 hover:text-black font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                      {t('post.readMore')}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 最新ブログセクション */}
        {latestBlogs.length > 0 && (
        <section className="py-12">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-6 gap-1 md:gap-0">
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900">最新ブログ</h3>
            <Button
              variant="ghost"
              className="text-gray-600 hover:text-black hover:bg-gray-100 font-medium text-base self-start md:self-auto"
              onClick={() => navigate('/blog')}
            >
              すべて見る <ArrowRight className="h-4 w-4 ml-1 inline" />
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-gray-200 border-t border-gray-200">
            {latestBlogs.slice(0, 6).map((blog: any) => (
              <div
                key={blog.id}
                className="group flex items-center gap-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors px-1"
                onClick={() => navigate(`/blog/${blog.slug}`)}
              >
                {/* 正方形サムネイル */}
                <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 overflow-hidden rounded-md bg-gray-100">
                  {blog.image_url ? (
                    <img
                      src={typeof blog.image_url === 'string' && blog.image_url.startsWith('http') ? blog.image_url : `${API_URL}${blog.image_url}`}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">📝</div>
                  )}
                </div>
                {/* タイトル＋抜粋 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm md:text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-gray-600 transition-colors">
                    {blog.title}
                  </h4>
                  {blog.excerpt && (
                    <p className="text-xs md:text-sm text-gray-500 line-clamp-2 leading-relaxed">
                      {blog.excerpt}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">カラット（Carat）</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* 参加CTA */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4">
            <div className="bg-white/95 border border-gray-200 shadow-xl rounded-2xl px-6 py-6 md:px-10 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="text-left">
                <p className="text-sm md:text-base text-slate-500 mb-1">{t('cta.communityTitle')}</p>
                <p className="text-lg md:text-xl font-serif text-slate-900">{t('cta.communitySubtitle')}</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => navigate('/about')}
                  className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 hover:text-black px-6 py-3 text-base md:text-lg font-medium shadow-md hover:shadow-lg transition-all"
                >
                  Caratとは
                </Button>
                <Button 
                  onClick={() => navigate('/subscribe')}
                  className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 hover:text-black px-6 py-3 text-base md:text-lg font-medium shadow-md hover:shadow-lg transition-all"
                >
                  {t('membership.registerMonthly')}
                </Button>
              </div>
            </div>
          </div>
        </section>

            </div>{/* /左カラム */}

            {/* 右カラム: ナビゲーションサイドバー */}
            <div className="hidden md:block md:w-48 flex-shrink-0">
              <div className="sticky top-36 space-y-4">
                {/* 会員専用グループ */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 text-white text-xs font-bold px-3 py-2">会員専用</div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: '💑 会員交流', path: '/matching' },
                      { label: '🏠 会員サロン', path: '/salon' },
                      { label: '💼 ビジネス', path: '/business' },
                    ].map(item => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors text-slate-700 font-medium"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 掲示板グループ */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 text-white text-xs font-bold px-3 py-2">掲示板</div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: '🎵 Music', path: '/category/music' },
                      { label: '🎨 アート・動画', path: '/category/art' },
                      { label: '🎭 サブカルチャー', path: '/category/comics' },
                      { label: '🍽️ 食レポ・お店', path: '/category/food' },
                      { label: '📍 ツーリズム', path: '/category/tourism' },
                      { label: '💬 掲示板', path: '/category/board' },
                    ].map(item => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors text-slate-700"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ニュース・ブロググループ */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-800 text-white text-xs font-bold px-3 py-2">コンテンツ</div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: '📰 ニュース', path: '/news' },
                      { label: '✍️ ブログ', path: '/blog' },
                    ].map(item => (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors text-slate-700"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>{/* /右カラム */}

          </div>{/* /flex */}
        </div>{/* /max-w-7xl */}
      </div>
      
      <UnderConstructionModal 
        isOpen={showConstructionModal}
        onClose={() => setShowConstructionModal(false)}
      />

      {/* プレミアムアップグレードモーダル */}
      <PremiumUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={upgradeFeatureName}
      />

      {/* ログインポップアップ */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginPrompt(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-serif font-semibold text-slate-900 mb-4">{t('auth.loginRequired')}</h3>
            <p className="text-slate-600 mb-6">
              {t('auth.loginRequiredMessage')}
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => {
                  setShowLoginPrompt(false);
                  navigate('/login');
                }}
                className="flex-1 bg-black text-white hover:bg-gray-800"
              >
                {t('auth.login')}
              </Button>
              <Button 
                onClick={() => setShowLoginPrompt(false)}
                variant="outline"
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HomePage;
