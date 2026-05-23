'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Song, Playlist } from './types';
import { createAuthBrowserClient } from './supabase-browser';
import { track } from './analytics';

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
  createPlaylist: (name: string, initialSongId?: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  signOutAuth: () => void;
  isSignedIn: boolean;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const post = (url: string, body: object) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => {});

const del = (url: string, body: object) =>
  fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => {});

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

  // Stable refs for use in zero-dep callbacks (same pattern as authModeRef)
  const playingTrackRef = useRef<Song | null>(null);
  const isPlayingRef = useRef(false);
  useEffect(() => { playingTrackRef.current = playingTrack; }, [playingTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Listen duration — cumulative play time per song, fires at 30s and 2min thresholds
  const listenSongIdRef = useRef<string | null>(null);
  const listenAccumRef = useRef(0);     // accumulated ms for current song
  const listenFiredRef = useRef({ s30: false, s120: false });
  const playStartRef = useRef<number | null>(null);  // timestamp of current play segment start

  useEffect(() => {
    if (!playingTrack) return;
    if (playingTrack.id !== listenSongIdRef.current) {
      listenSongIdRef.current = playingTrack.id;
      listenAccumRef.current = 0;
      listenFiredRef.current = { s30: false, s120: false };
    }
    if (!isPlaying) return;
    playStartRef.current = Date.now();
    const interval = setInterval(() => {
      const total = listenAccumRef.current + (Date.now() - (playStartRef.current ?? Date.now()));
      if (!listenFiredRef.current.s30 && total >= 30_000) {
        listenFiredRef.current.s30 = true;
        track('song-listen', { threshold: '30s', song_id: playingTrack.id, title: playingTrack.title_original ?? '', language: playingTrack.language_claimed ?? '' });
      }
      if (!listenFiredRef.current.s120 && total >= 120_000) {
        listenFiredRef.current.s120 = true;
        track('song-listen', { threshold: '2min', song_id: playingTrack.id, title: playingTrack.title_original ?? '', language: playingTrack.language_claimed ?? '' });
      }
    }, 1000);
    return () => {
      clearInterval(interval);
      if (playStartRef.current !== null) {
        listenAccumRef.current += Date.now() - playStartRef.current;
        playStartRef.current = null;
      }
    };
  }, [isPlaying, playingTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [karaokeMode, setKaraokeMode] = useState(false);
  const toggleKaraokeMode = useCallback(() => setKaraokeMode(v => {
    track('karaoke-toggle', { enabled: !v });
    return !v;
  }), []);

  const [autoAdvance, setAutoAdvance] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Auth mode as React state so persistence effects always see a consistent snapshot.
  // Ref is synced from state for use in write callbacks (no stale-closure risk).
  const [authMode, setAuthMode] = useState<'loading' | 'anon' | 'supabase'>('loading');
  const authModeRef = useRef<'loading' | 'anon' | 'supabase'>('loading');
  useEffect(() => { authModeRef.current = authMode; }, [authMode]);

  const loadFromLocalStorage = useCallback(() => {
    const savedFavs = localStorage.getItem('sof-favorites');
    if (savedFavs) { try { setFavorites(JSON.parse(savedFavs)); } catch { /* ignore */ } }
    const savedPls = localStorage.getItem('sof-playlists');
    if (savedPls) { try { setPlaylists(JSON.parse(savedPls)); } catch { /* ignore */ } }
  }, []);

  // All Supabase reads go through /api/user-data — server reads the session cookie
  // directly, bypassing the GoTrueClient lock that causes 5-second delays.
  const loadFromSupabase = useCallback(async () => {
    const res = await fetch('/api/user-data');
    if (!res.ok) return;
    const { favorites: favs, playlists: pls } = await res.json() as {
      favorites: string[];
      playlists: Playlist[];
    };
    setFavorites(favs);
    setPlaylists(pls);
  }, []);

  const signOutAuth = useCallback(() => {
    setAuthMode('anon');
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  // Determine initial auth state via /api/me (server read — no GoTrue lock contention).
  // onAuthStateChange handles only live cross-tab changes; INITIAL_SESSION is intentionally
  // ignored because /api/me already handles the initial load correctly.
  useEffect(() => {
    const supabase = createAuthBrowserClient();

    fetch('/api/me')
      .then(r => r.json())
      .then(async ({ user }: { user: { id: string } | null }) => {
        if (user) {
          setAuthMode('supabase');
          await loadFromSupabase();
        } else {
          setAuthMode('anon');
          loadFromLocalStorage();
        }
      })
      .catch(() => { setAuthMode('anon'); loadFromLocalStorage(); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          setAuthMode('anon');
          loadFromLocalStorage();
        } else if (event === 'SIGNED_IN' && session?.user) {
          track('sign-in');
          setAuthMode('supabase');
          await loadFromSupabase();
        }
        // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED — no action needed
      }
    );
    return () => subscription.unsubscribe();
  }, [loadFromLocalStorage, loadFromSupabase]);

  // Persist to localStorage only in anon mode.
  // authMode in deps ensures React batches the mode change and data change together —
  // no window where authMode='anon' while favorites still holds Supabase data.
  useEffect(() => {
    if (authMode === 'anon') localStorage.setItem('sof-favorites', JSON.stringify(favorites));
  }, [authMode, favorites]);

  useEffect(() => {
    if (authMode === 'anon') localStorage.setItem('sof-playlists', JSON.stringify(playlists));
  }, [authMode, playlists]);

  const toggleFavorite = useCallback((songId: string) => {
    if (authModeRef.current === 'supabase') {
      setFavorites(prev => {
        const has = prev.includes(songId);
        track('favorite-toggle', { song_id: songId, action: has ? 'remove' : 'add' });
        post('/api/user-data/favorites', { song_id: songId, action: has ? 'remove' : 'add' });
        return has ? prev.filter(id => id !== songId) : [...prev, songId];
      });
    } else if (authModeRef.current !== 'loading') {
      setFavorites(prev => {
        const has = prev.includes(songId);
        track('favorite-toggle', { song_id: songId, action: has ? 'remove' : 'add' });
        return has ? prev.filter(id => id !== songId) : [...prev, songId];
      });
    }
  }, []);

  const isFavorite = useCallback((songId: string) => favorites.includes(songId), [favorites]);

  const createPlaylist = useCallback((name: string, initialSongId?: string) => {
    if (authModeRef.current === 'supabase') {
      track('playlist-create');
      fetch('/api/user-data/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
        .then(r => r.json())
        .then(async (data: { id: string; name: string } | null) => {
          if (!data?.id) return;
          if (initialSongId) {
            await post('/api/user-data/playlist-songs', { playlist_id: data.id, song_id: initialSongId, position: 0 });
          }
          setPlaylists(prev => [...prev, { id: data.id, name: data.name, songIds: initialSongId ? [initialSongId] : [] }]);
        })
        .catch(() => {});
    }
    // guests cannot create playlists
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    if (authModeRef.current === 'supabase') {
      del('/api/user-data/playlists', { id });
    }
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    track('playlist-add-song');
    setPlaylists(prev => {
      const pl = prev.find(p => p.id === playlistId);
      const position = pl?.songIds.length ?? 0;
      if (authModeRef.current === 'supabase') {
        post('/api/user-data/playlist-songs', { playlist_id: playlistId, song_id: songId, position });
      }
      return prev.map(p =>
        p.id === playlistId ? { ...p, songIds: [...new Set([...p.songIds, songId])] } : p
      );
    });
  }, []);

  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    if (authModeRef.current === 'supabase') {
      del('/api/user-data/playlist-songs', { playlist_id: playlistId, song_id: songId });
    }
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, songIds: p.songIds.filter(id => id !== songId) } : p
    ));
  }, []);

  const setQueue = useCallback((newQueue: Song[]) => {
    setQueueState(newQueue);
  }, []);

  const playTrack = useCallback((song: Song, newQueue?: Song[]) => {
    track('song-play', { song_id: song.id, title: song.title_original ?? '', artist: song.artist ?? '', language: song.language_claimed ?? '' });
    setPlayingTrackState(song);
    setIsPlaying(true);
    if (newQueue) {
      setQueue(newQueue);
    }
  }, [setQueue]);

  const pauseTrack = useCallback(() => {
    track('song-pause', { song_id: playingTrackRef.current?.id });
    setIsPlaying(false);
  }, []);

  const resumeTrack = useCallback(() => {
    if (playingTrackRef.current) {
      track('song-resume', { song_id: playingTrackRef.current.id });
      setIsPlaying(true);
    }
  }, []);

  const togglePlay = useCallback(() => {
    track(isPlayingRef.current ? 'song-pause' : 'song-resume', { song_id: playingTrackRef.current?.id });
    setIsPlaying(prev => !prev);
  }, []);

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
    track('song-skip', { direction: 'next', from_song_id: playingTrack.id });
    setPlayingTrackState(queue[nextIndex]);
    setIsPlaying(true);
  }, [playingTrack, queue]);

  const prevTrack = useCallback(() => {
    if (!playingTrack || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playingTrack.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    track('song-skip', { direction: 'prev', from_song_id: playingTrack.id });
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
    signOutAuth,
    isSignedIn: authMode === 'supabase',
  }), [
    authMode,
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
    signOutAuth,
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
