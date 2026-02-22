import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowLeft, ArrowRight } from 'lucide-react';
import { BACKEND_URL } from '@/config';

interface BlogDetail {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  image_url: string | null;
  seo_keywords: string[] | null;
  published_at: string | null;
  created_at: string | null;
}

const PublicBlogDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<BlogDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/blog/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setBlog(data);
          updateSEO(data);
        }
      } catch (e) {
        console.error('Failed to fetch blog', e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      const jsonLd = document.getElementById('blog-jsonld');
      if (jsonLd) jsonLd.remove();
    };
  }, [slug]);

  const updateSEO = (data: BlogDetail) => {
    document.title = `${data.title} | Carat Community`;

    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (data.excerpt) {
      setMeta('description', data.excerpt);
      setMeta('og:description', data.excerpt, true);
    }
    if (data.seo_keywords?.length) {
      setMeta('keywords', data.seo_keywords.join(', '));
    }
    setMeta('og:title', data.title, true);
    setMeta('og:type', 'article', true);
    setMeta('og:url', window.location.href, true);
    if (data.image_url) {
      const imgUrl = data.image_url.startsWith('http') ? data.image_url : `${BACKEND_URL}${data.image_url}`;
      setMeta('og:image', imgUrl, true);
    }

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      description: data.excerpt || '',
      image: data.image_url ? (data.image_url.startsWith('http') ? data.image_url : `${BACKEND_URL}${data.image_url}`) : '',
      datePublished: data.published_at || data.created_at || '',
      author: { '@type': 'Organization', name: 'Carat Community' },
      publisher: { '@type': 'Organization', name: 'Carat Community' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    };
    let script = document.getElementById('blog-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'blog-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '';
    const locale = i18n.language === 'ja' ? 'ja-JP' : i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'de' ? 'de-DE' : i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'pt' ? 'pt-BR' : i18n.language === 'it' ? 'it-IT' : 'en-US';
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-64 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 mb-4">{t('blogDetail.notFound')}</p>
        <Link to="/blog">
          <Button variant="outline">{t('blogDetail.backToList')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" /> {t('blogDetail.backToList')}
      </Link>

      <article>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{blog.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <time dateTime={blog.published_at || undefined}>{formatDate(blog.published_at)}</time>
          </div>
        </div>

        {blog.seo_keywords && blog.seo_keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {blog.seo_keywords.map((kw, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{kw}</span>
            ))}
          </div>
        )}

        {blog.image_url && (
          <img
            src={blog.image_url.startsWith('http') ? blog.image_url : `${BACKEND_URL}${blog.image_url}`}
            alt={blog.title}
            className="w-full rounded-lg mb-8 shadow-sm"
          />
        )}

        <div className="prose prose-lg max-w-none mb-12">
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{blog.body}</div>
        </div>

        <Card className="bg-gradient-to-r from-pink-50 to-orange-50 border-pink-200">
          <CardContent className="p-6 text-center space-y-3">
            <h3 className="text-lg font-bold text-gray-800">{t('blogDetail.ctaTitle')}</h3>
            <p className="text-sm text-gray-600">{t('blogDetail.ctaDescription')}</p>
            <Link to="/">
              <Button className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white">
                {t('blogDetail.ctaButton')} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </article>
    </div>
  );
};

export default PublicBlogDetailPage;
