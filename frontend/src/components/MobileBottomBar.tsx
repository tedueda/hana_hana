import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Globe, Check, Copy } from 'lucide-react';

const MobileBottomBar: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setVisible(false);
  }, [location.pathname]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[300] md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <button
        onClick={handleCopy}
        className="w-full bg-gray-100 border-t border-gray-300 px-4 py-2.5 flex items-center justify-center gap-2 active:bg-gray-200 transition-colors"
      >
        <Globe className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm text-gray-700 font-medium tracking-wide">
          carat-community.com
        </span>
        {copied ? (
          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
    </div>
  );
};

export default MobileBottomBar;
