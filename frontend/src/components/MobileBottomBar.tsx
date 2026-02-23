import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Globe } from 'lucide-react';

const MobileBottomBar: React.FC = () => {
  const [visible, setVisible] = useState(false);
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

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[300] md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-2.5 flex items-center justify-center gap-2">
        <Globe className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm text-gray-700 font-medium tracking-wide">
          carat-community.com
        </span>
      </div>
    </div>
  );
};

export default MobileBottomBar;
