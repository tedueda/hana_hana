import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';

interface OgpThumbnailProps {
  url: string;
  alt?: string;
  fallback: React.ReactNode;
  className?: string;
  imgClassName?: string;
}

const BACKEND_URL = API_URL;

const OgpThumbnail: React.FC<OgpThumbnailProps> = ({ url, alt = '', fallback, className = '', imgClassName = '' }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchOgImage = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ogp?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!cancelled) {
          if (data.image) {
            setImageUrl(data.image);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };
    fetchOgImage();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return <div className={`${className} animate-pulse bg-gray-200`} />;
  }

  if (error || !imageUrl) {
    return <>{fallback}</>;
  }

  return (
    <div className={className}>
      <img
        src={imageUrl}
        alt={alt}
        className={imgClassName}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default OgpThumbnail;
