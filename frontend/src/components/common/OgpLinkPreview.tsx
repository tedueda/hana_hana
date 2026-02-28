import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { BACKEND_URL } from '../../config';

interface OgpData {
  title: string;
  description: string;
  image: string;
  site_name: string;
  url: string;
}

interface OgpLinkPreviewProps {
  url: string;
}

const OgpLinkPreview: React.FC<OgpLinkPreviewProps> = ({ url }) => {
  const [ogp, setOgp] = useState<OgpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOgp = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ogp?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!cancelled) {
          setOgp(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };
    fetchOgp();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400 text-sm">リンクプレビューを読み込み中...</span>
      </div>
    );
  }

  if (error || !ogp || (!ogp.image && !ogp.title)) {
    return null;
  }

  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return ''; }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow bg-white"
    >
      {ogp.image && (
        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
          <img
            src={ogp.image}
            alt={ogp.title || 'Link preview'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3">
        {ogp.title && (
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">{ogp.title}</h3>
        )}
        {ogp.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{ogp.description}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ExternalLink className="w-3 h-3" />
          <span>{ogp.site_name || hostname}</span>
        </div>
      </div>
    </a>
  );
};

export default OgpLinkPreview;
