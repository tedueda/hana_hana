import { useState, useCallback } from 'react';
import { Volume2, VolumeX, Pause, Music } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

const GlobalAudioPlayer = () => {
  const { isPlaying, volume, togglePlay, setVolume } = useAudio();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, [setVolume]);

  // Only show floating player when music is playing and user has navigated away from hero
  if (!isPlaying) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-full px-4 py-2.5 shadow-2xl border border-white/10"
      onMouseEnter={() => setShowVolumeSlider(true)}
      onMouseLeave={() => setShowVolumeSlider(false)}
    >
      <Music className="w-4 h-4 text-white/60" />

      <button
        onClick={togglePlay}
        className="text-white hover:text-gray-300 transition-colors p-1 focus:outline-none rounded"
        aria-label="Stop"
        type="button"
      >
        <Pause className="w-5 h-5" />
      </button>

      <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
          aria-label="Volume"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="text-white/80">
        {volume === 0 ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </div>

      <div className="flex items-center gap-0.5 ml-0.5">
        <span className="w-0.5 h-2.5 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
        <span className="w-0.5 h-3.5 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
        <span className="w-0.5 h-2 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  );
};

export default GlobalAudioPlayer;
