import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const AUDIO_TRACKS = [
  '/audio/marvin_Gzy01.mp3',
  '/audio/marvin_Gzy02.mp3',
  '/audio/marvin_Gzy03.mp3',
];

interface AudioContextType {
  isPlaying: boolean;
  volume: number;
  togglePlay: () => void;
  setVolume: (v: number) => void;
}

const AudioCtx = createContext<AudioContextType>({
  isPlaying: false,
  volume: 0.5,
  togglePlay: () => {},
  setVolume: () => {},
});

export const useAudio = () => useContext(AudioCtx);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // Initialize audio element once (persists across page navigations)
  useEffect(() => {
    const audio = new Audio();
    audio.src = AUDIO_TRACKS[0];
    audio.volume = 0.5;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Handle track ended - play next track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const nextIndex = (currentTrackIndex + 1) % AUDIO_TRACKS.length;
      setCurrentTrackIndex(nextIndex);
      audio.src = AUDIO_TRACKS[nextIndex];
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentTrackIndex, isPlaying]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    } else {
      audio.currentTime = 0;
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Audio play error:', err));
    }
  }, [isPlaying]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
  }, []);

  return (
    <AudioCtx.Provider value={{ isPlaying, volume, togglePlay, setVolume }}>
      {children}
    </AudioCtx.Provider>
  );
};
