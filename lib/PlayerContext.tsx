'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Song, Playlist } from './types';

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
  autoAdvance: boolean;
  setAutoAdvance: (v: boolean) => void;
  duration: number;
  setDuration: (d: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
  seekTo: (seconds: number) => void;
  registerSeekFn: (fn: (s: number) => void) => void;
  favorites: string[];
  toggleFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playingTrack, setPlayingTrackState] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const seekFnRef = useRef<((s: number) => void) | null>(null);
  const seekTo = useCallback((seconds: number) => seekFnRef.current?.(seconds), []);
  const registerSeekFn = useCallback((fn: (s: number) => void) => { seekFnRef.current = fn; }, []);

  const [autoAdvance, setAutoAdvance] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedFavs = localStorage.getItem('sof-favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) { console.error('Failed to parse favorites', e); }
    }
    const savedPlaylists = localStorage.getItem('sof-playlists');
    if (savedPlaylists) {
      try { setPlaylists(JSON.parse(savedPlaylists)); } catch (e) { console.error('Failed to parse playlists', e); }
    }
  }, []);

  // Save data to localStorage when they change
  useEffect(() => {
    localStorage.setItem('sof-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('sof-playlists', JSON.stringify(playlists));
  }, [playlists]);

  const toggleFavorite = useCallback((songId: string) => {
    setFavorites(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId) 
        : [...prev, songId]
    );
  }, []);

  const isFavorite = useCallback((songId: string) => {
    return favorites.includes(songId);
  }, [favorites]);

  const createPlaylist = useCallback((name: string) => {
    setPlaylists(prev => [
      ...prev,
      { id: `pl-${Date.now()}`, name, songIds: [] }
    ]);
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev => prev.map(p => 
      p.id === playlistId 
        ? { ...p, songIds: [...new Set([...p.songIds, songId])] } 
        : p
    ));
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev => prev.map(p => 
      p.id === playlistId 
        ? { ...p, songIds: p.songIds.filter(id => id !== songId) } 
        : p
    ));
  }, []);

  const setQueue = useCallback((newQueue: Song[]) => {
    setQueueState(newQueue);
  }, []);

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
    if (!playingTrack || queue.length === 0) {
      setIsPlaying(false);
      setProgress(0);
      return;
    }
    const currentIndex = queue.findIndex(s => s.id === playingTrack.id);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setIsPlaying(false);
      setProgress(0);
      return;
    }
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

  const contextValue = React.useMemo(() => ({
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
    seekTo,
    registerSeekFn,
    isPanelOpen,
    setIsPanelOpen,
    progress,
    setProgress,
    duration,
    setDuration,
    volume,
    setVolume,
    autoAdvance,
    setAutoAdvance,
    favorites,
    toggleFavorite,
    isFavorite,
    playlists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
  }), [
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
    seekTo,
    registerSeekFn,
    isPanelOpen,
    progress,
    duration,
    volume,
    autoAdvance,
    favorites,
    toggleFavorite,
    isFavorite,
    playlists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
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
