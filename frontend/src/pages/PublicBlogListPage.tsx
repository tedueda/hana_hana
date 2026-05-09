import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { BACKEND_URL } from '@/config';

const ITEMS_PER_PAGE = 15;

interface BlogItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string | null;
}

const PublicBlogListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    document.title = 'ブログ | カラット（Carat）- LGBTQ+コミュニティ';
    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };
    setMeta('description', 'カラット（Carat）のLGBTQ+コミュニティブログ。ゲイ・レズビアン・バイセクシャル・トランスジェンダーに関する最新情報、体験談、コラムをお届けします。');
    setMeta('og:title', 'ブログ | カラット（Carat）- LGBTQ+コミュニティ', true);
    setMeta('og:description', 'LGBTQ+コミュニティの最新情報、体験談、コラムをお届けします。', true);
    setMeta('og:url', 'https://carat-community.com/blog', true);
    setMeta('og:type', 'website', true);
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://carat-community.com/blog';
    return () => { document.title = 'カラット（Carat）- 日本最大級のLGBTQ+コミュニティ | ゲイ・レズビアン・トランスジェンダーの交流プラットフォーム'; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BACKEND_URL}/api/blog?lang=${i18n.language}`);
        if (res.ok) setBlogs(await res.json());
      } catch (e) {
        console.error('Failed to fetch blogs', e);
      } finally {
        setLoading(false);
      }
    })();
    setCurrentPage(1);
  }, [i18n.language]);

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const locale = i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'de' ? 'de-DE' : i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'pt' ? 'pt-BR' : i18n.language === 'it' ? 'it-IT' : 'en-US';
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('blogPage.title')}</h1>
        <p className="text-gray-600 mt-1">{t('blogPage.subtitle')}</p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="h-48 bg-gray-200 animate-pulse" />
              <CardContent className="p-5 space-y-3">
                <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <Card className="text-center p-12">
          <CardContent>
            <p className="text-gray-500">{t('blogPage.noPosts')}</p>
          </CardContent>
        </Card>
      ) : (() => {
        const totalPages = Math.ceil(blogs.length / ITEMS_PER_PAGE);
        const pagedBlogs = blogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
        return (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pagedBlogs.map(blog => (
                <Link key={blog.id} to={`/blog/${blog.slug}`} className="group">
                  <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
                    {blog.image_url && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={blog.image_url.startsWith('http') ? blog.image_url : `${BACKEND_URL}${blog.image_url}`}
                          alt={blog.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-3">
                      <h2 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {blog.title}
                      </h2>
                      {blog.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-3">{blog.excerpt}</p>
                      )}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(blog.published_at)}</span>
                        </div>
                        <span className="flex items-center gap-1 text-blue-600 group-hover:underline">
                          {t('blogPage.readMore')} <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="前のページ"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pageNumbers.map(n => (
                  <button
                    key={n}
                    onClick={() => { setCurrentPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      n === currentPage
                        ? 'bg-gray-900 text-white'
                        : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}

                <button
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="次のページ"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default PublicBlogListPage;
