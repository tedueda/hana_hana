import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';

interface SunoEmbedPlayerProps {
  url: string;
}

const SunoEmbedPlayer: React.FC<SunoEmbedPlayerProps> = ({ url }) => {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveEmbed = async () => {
      try {
        // Check if this is already a /song/{uuid} URL
        const uuidMatch = url.match(/\/song\/([a-f0-9-]{36})/);
        if (uuidMatch) {
          if (!cancelled) {
            setEmbedUrl(`https://suno.com/embed/${uuidMatch[1]}`);
            setLoading(false);
          }
          return;
        }

        // Short URL (/s/{id}) - resolve via backend
        const res = await fetch(`${API_URL}/api/ogp/resolve-suno?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('resolve failed');
        const data = await res.json();
        if (!cancelled && data.embed_url) {
          setEmbedUrl(data.embed_url);
          setLoading(false);
        } else {
          throw new Error('no embed_url');
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    resolveEmbed();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-[200px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-gray-400 text-sm">Suno プレーヤーを読み込み中...</span>
      </div>
    );
  }

  if (error || !embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎵</span>
          <div>
            <p className="font-medium text-gray-900">Suno で再生</p>
            <p className="text-sm text-gray-500 truncate">{url}</p>
          </div>
        </div>
      </a>
    );
  }

  return (
    <div style={{ width: '100%', height: '200px', position: 'relative' }}>
      <iframe
        src={embedUrl}
        style={{ top: 0, left: 0, width: '100%', height: '100%', position: 'absolute', border: 0, borderRadius: '8px' }}
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
};

export default SunoEmbedPlayer;
