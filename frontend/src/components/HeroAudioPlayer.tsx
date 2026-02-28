import { useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

export const HeroAudioPlayer = () => {
  const { isPlaying, volume, togglePlay, setVolume } = useAudio();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, [setVolume]);

  return (
    <div 
      className="flex items-center justify-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg cursor-pointer relative z-50"
      onMouseEnter={() => setShowVolumeSlider(true)}
      onMouseLeave={() => setShowVolumeSlider(false)}
      onClick={(e) => {
        console.log('🎯 Container clicked!', e.target);
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="text-white hover:text-gray-300 transition-colors p-2 focus:outline-none focus:ring-2 focus:ring-white rounded"
        aria-label={isPlaying ? 'Stop' : 'Play'}
        type="button"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </button>

      {/* Volume slider - shown on hover or when interacting */}
      <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${showVolumeSlider ? 'w-24 opacity-100' : 'w-0 opacity-0'}`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
          aria-label="Volume"
        />
      </div>

      {/* Volume icon */}
      <div className="text-white">
        {volume === 0 ? (
          <VolumeX className="w-5 h-5" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </div>

      {/* Status indicator */}
      {isPlaying && (
        <div className="flex items-center gap-0.5 ml-1">
          <span className="w-1 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
        </div>
      )}
    </div>
  );
};

export default HeroAudioPlayer;
