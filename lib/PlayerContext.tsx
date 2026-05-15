'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Song } from './types';

interface PlayerContextType {
  playingTrack: Song | null;
  isPlaying: boolean;
  queue: Song[];
  playTrack: (song: Song, newQueue?: Song[]) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setQueue: (queue: Song[]) => void;
  duration: number;
  setDuration: (d: number) => void;
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playingTrack, setPlayingTrackState] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const playTrack = useCallback((song: Song, newQueue?: Song[]) => {
    setPlayingTrackState(song);
    setIsPlaying(true);
    if (newQueue) {
      setQueue(newQueue);
    }
  }, []);

  const pauseTrack = useCallback(() => setIsPlaying(false), []);
  const resumeTrack = useCallback(() => {
    if (playingTrack) setIsPlaying(true);
  }, [playingTrack]);

  const togglePlay = useCallback(() => setIsPlaying(prev => !prev), []);

  const nextTrack = useCallback(() => {
    if (!playingTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playingTrack.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    setPlayingTrackState(queue[nextIndex]);
    setIsPlaying(true);
  }, [playingTrack, queue]);

  const prevTrack = useCallback(() => {
    if (!playingTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playingTrack.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    setPlayingTrackState(queue[prevIndex]);
    setIsPlaying(true);
  }, [playingTrack, queue]);

  return (
    <PlayerContext.Provider
      value={{
        playingTrack,
        isPlaying,
        queue,
        playTrack,
        pauseTrack,
        resumeTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        setQueue,
        isPanelOpen,
        setIsPanelOpen,
        progress,
        setProgress,
        duration,
        setDuration,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
