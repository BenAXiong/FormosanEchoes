'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });
import { usePlayer } from '@/lib/PlayerContext';
import { getDisplayTitle, isYouTubeUrl, getYouTubeId } from '@/lib/normalize';
import { createPortal } from 'react-dom';

export default function PlayerBar() {
  const { 
    playingTrack, isPlaying, togglePlay, nextTrack, prevTrack, 
    progress, setProgress, duration, setDuration 
  } = usePlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className={`fixed bottom-0 inset-x-0 h-20 bg-[#050505] border-t border-white/10 z-[60] px-4 flex items-center justify-between shadow-2xl transition-transform duration-500 ${!playingTrack ? 'translate-y-full' : 'translate-y-0'}`}>
      
      {/* MASTER PLAYER (Handles Audio) */}
      <div className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none overflow-hidden">
        {playingTrack && (
          <ReactPlayer
            url={cleanUrl}
            playing={isPlaying}
            onEnded={nextTrack}
            onProgress={(state) => setProgress(state.playedSeconds)}
            onDuration={(d) => setDuration(d)}
            config={{
              youtube: {
                playerVars: { autoplay: 1, controls: 0 }
              }
            }}
          />
        )}
      </div>

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
        {/* Fav Button (future) */}
        <button className="text-stone-500 hover:text-emerald-500 transition-colors ml-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

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
          <div className="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden cursor-pointer">
            <div 
              className="absolute top-0 left-0 h-full bg-white group-hover:bg-emerald-500 transition-colors"
              style={{ width: `${(progress / duration) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-500 w-8 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Options */}
      <div className="flex items-center justify-end gap-3 w-1/3">
        <button className="text-stone-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <div className="w-24 h-1 bg-white/10 rounded-full relative overflow-hidden cursor-pointer group">
          <div className="absolute top-0 left-0 h-full w-2/3 bg-stone-400 group-hover:bg-emerald-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}
