'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Song, Playlist } from './types';
import { createAuthBrowserClient } from './supabase-browser';

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
  seekMirror: (seconds: number) => void;
  registerMirrorSeekFn: (fn: ((s: number) => void) | null) => void;
  togglePanel: () => void;
  registerTogglePanelFn: (fn: (() => void) | null) => void;
  karaokeMode: boolean;
  toggleKaraokeMode: () => void;
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
  const mirrorSeekFnRef = useRef<((s: number) => void) | null>(null);
  const togglePanelFnRef = useRef<(() => void) | null>(null);
  const seekTo = useCallback((seconds: number) => seekFnRef.current?.(seconds), []);
  const seekMirror = useCallback((seconds: number) => mirrorSeekFnRef.current?.(seconds), []);
  const registerSeekFn = useCallback((fn: (s: number) => void) => { seekFnRef.current = fn; }, []);
  const registerMirrorSeekFn = useCallback((fn: ((s: number) => void) | null) => { mirrorSeekFnRef.current = fn; }, []);
  const togglePanel = useCallback(() => togglePanelFnRef.current?.(), []);
  const registerTogglePanelFn = useCallback((fn: (() => void) | null) => { togglePanelFnRef.current = fn; }, []);

  const [karaokeMode, setKaraokeMode] = useState(false);
  const toggleKaraokeMode = useCallback(() => setKaraokeMode(v => !v), []);

  const [autoAdvance, setAutoAdvance] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const authModeRef = useRef<'anon' | 'supabase'>('anon');
  const userIdRef = useRef<string | null>(null);

  // Load anon data from localStorage
  const loadFromLocalStorage = useCallback(() => {
    const savedFavs = localStorage.getItem('sof-favorites');
    if (savedFavs) { try { setFavorites(JSON.parse(savedFavs)); } catch { /* ignore */ } }
    const savedPls = localStorage.getItem('sof-playlists');
    if (savedPls) { try { setPlaylists(JSON.parse(savedPls)); } catch { /* ignore */ } }
  }, []);

  // Watch auth state — switch between Supabase and localStorage backing store
  useEffect(() => {
    const supabase = createAuthBrowserClient();
    loadFromLocalStorage();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        authModeRef.current = 'supabase';
        userIdRef.current = session.user.id;
        // Load favorites
        const { data: favRows } = await supabase.from('user_favorites').select('song_id');
        setFavorites((favRows as { song_id: string }[] | null)?.map(r => r.song_id) ?? []);
        // Load playlists + songs
        const { data: plRows } = await supabase
          .from('user_playlists')
          .select('id, name, user_playlist_songs(song_id, position)')
          .order('created_at');
        if (plRows) {
          setPlaylists((plRows as { id: string; name: string; user_playlist_songs: { song_id: string; position: number }[] }[]).map(p => ({
            id: p.id,
            name: p.name,
            songIds: p.user_playlist_songs
              .sort((a, b) => a.position - b.position)
              .map(ps => ps.song_id),
          })));
        }
      } else {
        authModeRef.current = 'anon';
        userIdRef.current = null;
        loadFromLocalStorage();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadFromLocalStorage]);

  // Persist to localStorage only in anon mode
  useEffect(() => {
    if (authModeRef.current === 'anon') localStorage.setItem('sof-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (authModeRef.current === 'anon') localStorage.setItem('sof-playlists', JSON.stringify(playlists));
  }, [playlists]);

  const toggleFavorite = useCallback((songId: string) => {
    if (authModeRef.current === 'supabase' && userIdRef.current) {
      const uid = userIdRef.current;
      setFavorites(prev => {
        const has = prev.includes(songId);
        const supabase = createAuthBrowserClient();
        if (has) {
          supabase.from('user_favorites').delete().match({ user_id: uid, song_id: songId }).then(() => {});
          return prev.filter(id => id !== songId);
        } else {
          supabase.from('user_favorites').insert({ user_id: uid, song_id: songId }).then(() => {});
          return [...prev, songId];
        }
      });
    } else {
      setFavorites(prev =>
        prev.includes(songId) ? prev.filter(id => id !== songId) : [...prev, songId]
      );
    }
  }, []);

  const isFavorite = useCallback((songId: string) => favorites.includes(songId), [favorites]);

  const createPlaylist = useCallback((name: string) => {
    if (authModeRef.current === 'supabase' && userIdRef.current) {
      const uid = userIdRef.current;
      createAuthBrowserClient()
        .from('user_playlists')
        .insert({ user_id: uid, name })
        .select('id, name')
        .single()
        .then((result: { data: { id: string; name: string } | null }) => {
          if (result.data) setPlaylists(prev => [...prev, { id: result.data!.id, name: result.data!.name, songIds: [] }]);
        });
    } else {
      setPlaylists(prev => [...prev, { id: `pl-${Date.now()}`, name, songIds: [] }]);
    }
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    if (authModeRef.current === 'supabase') {
      createAuthBrowserClient().from('user_playlists').delete().eq('id', id).then(() => {});
    }
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev => {
      const pl = prev.find(p => p.id === playlistId);
      const position = pl?.songIds.length ?? 0;
      if (authModeRef.current === 'supabase') {
        createAuthBrowserClient()
          .from('user_playlist_songs')
          .insert({ playlist_id: playlistId, song_id: songId, position })
          .then(() => {});
      }
      return prev.map(p =>
        p.id === playlistId ? { ...p, songIds: [...new Set([...p.songIds, songId])] } : p
      );
    });
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    if (authModeRef.current === 'supabase') {
      createAuthBrowserClient()
        .from('user_playlist_songs')
        .delete()
        .match({ playlist_id: playlistId, song_id: songId })
        .then(() => {});
    }
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, songIds: p.songIds.filter(id => id !== songId) } : p
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
    seekMirror,
    registerMirrorSeekFn,
    togglePanel,
    registerTogglePanelFn,
    karaokeMode,
    toggleKaraokeMode,
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
    seekMirror,
    registerMirrorSeekFn,
    togglePanel,
    registerTogglePanelFn,
    karaokeMode,
    toggleKaraokeMode,
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
