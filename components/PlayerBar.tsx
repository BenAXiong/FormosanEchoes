'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { usePlayer } from '@/lib/PlayerContext';
import { getDisplayTitle, isYouTubeUrl, getYouTubeId } from '@/lib/normalize';

export default function PlayerBar() {
  const {
    playingTrack, isPlaying, togglePlay, nextTrack, prevTrack, pauseTrack,
    progress, setProgress, duration, setDuration,
    volume, setVolume, toggleFavorite, isFavorite,
    playlists, addSongToPlaylist, createPlaylist,
    registerSeekFn, seekTo, seekMirror, autoAdvance, togglePanel,
    karaokeMode, toggleKaraokeMode,
  } = usePlayer();
  const playerRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    registerSeekFn((seconds) => playerRef.current?.seekTo(seconds, 'seconds'));
  }, [registerSeekFn]);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlaylistDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  };

  if (!mounted) return null;

  const title = playingTrack ? getDisplayTitle(playingTrack) : 'No song selected';
  const artist = playingTrack?.artist || '—';
  const youtubeId = playingTrack && isYouTubeUrl(playingTrack.youtube_url) ? getYouTubeId(playingTrack.youtube_url!) : null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean URL to ensure react-player matches it correctly
  const cleanUrl = playingTrack?.youtube_url?.split('&')[0] || '';

  return (
    <div className={`fixed bottom-0 inset-x-0 bg-[#050505] border-t border-white/10 z-[60] shadow-2xl transition-transform duration-500 ${!playingTrack ? 'translate-y-full' : 'translate-y-0'}`}>
      
      {/* MASTER PLAYER (Handles Audio) */}
      <div className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none overflow-hidden">
        {playingTrack && (
          <ReactPlayer
            ref={playerRef}
            url={cleanUrl}
            playing={isPlaying}
            onEnded={() => { if (autoAdvance) nextTrack(); else { pauseTrack(); seekTo(0); seekMirror(0); setProgress(0); } }}
            onProgress={(state) => setProgress(state.playedSeconds)}
            onDuration={(d) => setDuration(d)}
            volume={volume}
            config={{
              youtube: {
                playerVars: { autoplay: 1, controls: 0 }
              }
            }}
          />
        )}
      </div>

      {/* ── Mobile layout (hidden on sm+) ─────────────────────────────── */}
      <div className="sm:hidden flex flex-col w-full">
        {/* Row 1: song info + action buttons */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <button
            onClick={togglePanel}
            className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
          >
            <div className="w-10 h-10 rounded bg-stone-900 overflow-hidden shrink-0 border border-white/5">
              {youtubeId
                ? <img src={`https://img.youtube.com/vi/${youtubeId}/default.jpg`} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-stone-700 text-lg">♪</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate leading-tight">{title}</p>
              <p className="text-stone-400 text-xs truncate mt-0.5">{artist}</p>
            </div>
          </button>
          <button
            onClick={() => playingTrack && toggleFavorite(playingTrack.id)}
            className={`p-2 transition-colors shrink-0 ${playingTrack && isFavorite(playingTrack.id) ? 'text-emerald-500' : 'text-stone-500 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill={playingTrack && isFavorite(playingTrack.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
              className={`p-2 transition-colors ${showPlaylistDropdown ? 'text-white' : 'text-stone-500 hover:text-white'}`}
              title="Add to playlist"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {showPlaylistDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[70]">
                <div className="p-3 border-b border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Add to Playlist</p>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {playlists.length === 0 ? (
                    <p className="px-4 py-3 text-[11px] text-stone-600 italic">No custom playlists yet</p>
                  ) : playlists.map(p => (
                    <button key={p.id}
                      onClick={() => { if (playingTrack) { addSongToPlaylist(p.id, playingTrack.id); showToast(`Added to ${p.name}`); } setShowPlaylistDropdown(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-stone-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      {playingTrack && p.songIds.includes(playingTrack.id) && <span className="text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-white/5">
                  <form onSubmit={(e) => { e.preventDefault(); if (newPlaylistName.trim()) { createPlaylist(newPlaylistName.trim()); showToast(`Created ${newPlaylistName.trim()}`); setNewPlaylistName(''); setShowPlaylistDropdown(false); } }} className="flex gap-1">
                    <input autoFocus type="text" placeholder="New playlist…" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-colors" />
                    <button type="submit" disabled={!newPlaylistName.trim()} className="px-2 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/20 disabled:opacity-50 transition-colors">Add</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: playback controls + flanking buttons */}
        <div className="flex items-center justify-between px-6 py-1">
          {/* Info button (not wired) */}
          <button
            aria-label="Song info"
            className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-[13px] text-stone-400 active:text-white transition-colors"
          >ℹ</button>

          {/* Prev / Play / Next */}
          <div className="flex items-center gap-10">
            <button onClick={prevTrack} className="text-stone-400 active:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black active:scale-95 transition-transform">
              {isPlaying
                ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                : <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <button onClick={nextTrack} className="text-stone-400 active:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          {/* Karaoke toggle */}
          <button
            onClick={toggleKaraokeMode}
            aria-label={karaokeMode ? 'Exit karaoke mode' : 'Enter karaoke mode'}
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-base transition-colors ${karaokeMode ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/5 text-stone-400 active:text-white'}`}
          >🎤</button>
        </div>

        {/* Row 3: full-width seek bar */}
        <div className="px-4 pb-3 pt-1">
          <div className="relative h-1 bg-white/10 rounded-full group">
            <div className="absolute top-0 left-0 h-full bg-white rounded-full pointer-events-none"
              style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            <input type="range" min="0" max={duration || 100} step="0.5" value={progress}
              onChange={e => { const s = parseFloat(e.target.value); setProgress(s); seekTo(s); }}
              onPointerUp={e => seekMirror(parseFloat((e.target as HTMLInputElement).value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-stone-500 font-mono">{formatTime(progress)}</span>
            <span className="text-[10px] text-stone-500 font-mono">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* ── Desktop layout (hidden below sm) ──────────────────────────── */}
      <div className="hidden sm:flex items-center justify-between w-full h-20 px-4">

      {/* Left: Song Info */}
      <div className="flex items-center gap-3 w-1/3">
        <div className="w-12 h-12 rounded bg-stone-900 overflow-hidden flex-shrink-0 border border-white/5 shadow-lg">
          {youtubeId ? (
            <img 
              src={`https://img.youtube.com/vi/${youtubeId}/default.jpg`} 
              alt="" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-700 text-xl">♪</div>
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white truncate hover:underline cursor-pointer">{title}</h4>
          <p className="text-xs text-stone-400 truncate">{playingTrack?.artist || 'Unknown Artist'}</p>
        </div>
        <div className="flex items-center gap-2 ml-2 relative" ref={dropdownRef}>
          {/* Fav Button */}
          <button 
            onClick={() => playingTrack && toggleFavorite(playingTrack.id)}
            className={`transition-colors p-1 rounded-full hover:bg-white/5 ${playingTrack && isFavorite(playingTrack.id) ? 'text-emerald-500' : 'text-stone-500 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill={playingTrack && isFavorite(playingTrack.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Add to Playlist Button */}
          <button 
            onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
            className={`transition-colors p-1 rounded-full hover:bg-white/5 ${showPlaylistDropdown ? 'text-white bg-white/10' : 'text-stone-500 hover:text-white'}`}
            title="Add to playlist"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {showPlaylistDropdown && (
            <div className="absolute bottom-full left-0 mb-4 w-56 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[70] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-3 border-b border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Add to Playlist</p>
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {playlists.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-stone-600 italic">No custom playlists yet</p>
                ) : (
                  playlists.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (playingTrack) {
                          addSongToPlaylist(p.id, playingTrack.id);
                          showToast(`Added to ${p.name}`);
                        }
                        setShowPlaylistDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-stone-300 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-between group"
                    >
                      <span>{p.name}</span>
                      {playingTrack && p.songIds.includes(playingTrack.id) && (
                        <span className="text-emerald-500">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-white/5 bg-white/[0.02]">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPlaylistName.trim()) {
                      createPlaylist(newPlaylistName.trim());
                      showToast(`Created ${newPlaylistName.trim()}`);
                      setNewPlaylistName('');
                      setShowPlaylistDropdown(false);
                    }
                  }}
                  className="flex gap-1"
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder="New playlist..."
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={!newPlaylistName.trim()}
                    className="px-2 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toast.message}
        </div>
      )}

      {/* Center: Controls */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-xl">
        <div className="flex items-center gap-5">
          <button onClick={prevTrack} className="text-stone-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform active:scale-95"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button onClick={nextTrack} className="text-stone-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full flex items-center gap-2 group">
          <span className="text-[10px] text-stone-500 w-8 text-right font-mono">{formatTime(progress)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-white group-hover:bg-emerald-500 transition-colors rounded-full pointer-events-none"
              style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.5"
              value={progress}
              onChange={(e) => {
                const seconds = parseFloat(e.target.value);
                setProgress(seconds);
                seekTo(seconds);
              }}
              onPointerUp={(e) => seekMirror(parseFloat((e.target as HTMLInputElement).value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-[10px] text-stone-500 w-8 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Options & Volume */}
      <div className="flex items-center justify-end gap-3 w-1/3">
        <div className="flex items-center gap-2 group w-32">
          <svg className="w-4 h-4 text-stone-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
            <div className="absolute top-0 left-0 h-full bg-stone-400 group-hover:bg-emerald-500 transition-colors rounded-full"
              style={{ width: `${volume * 100}%` }} />
            <input type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </div>
        </div>
      </div>

      </div>{/* end desktop layout */}
    </div>
  );
}
