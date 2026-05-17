'use client';
import { useState } from 'react';
import type { Song } from '@/lib/types';
import { getDisplayTitle, isYouTubeUrl, getYouTubeId, getYouTubeStartTime } from '@/lib/normalize';
import HoverableWord from '@/components/browser/HoverableWord';
import { usePlayer } from '@/lib/PlayerContext';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

function RomLyrics({ text, language, large }: { text: string; language?: string | null; large?: boolean }) {
  return (
    <div className={`leading-loose ${large ? 'text-xl text-center' : 'text-sm'}`}>
      {text.split('\n').map((line, li) => (
        <div key={li} className="min-h-[1.5rem]">
          {line.split(' ').filter(Boolean).map((word, wi) => (
            <HoverableWord key={wi} word={word} language={language} />
          ))}
        </div>
      ))}
    </div>
  );
}

const CONFIDENCE_CONFIG = {
  high: { label: 'High confidence', className: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  medium: { label: 'Medium confidence', className: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  low: { label: 'Low confidence', className: 'bg-orange-900/60 text-orange-300 border-orange-700' },
  unknown: { label: 'Unknown confidence', className: 'bg-stone-800 text-stone-400 border-stone-700' },
};
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  candidate: { label: 'Candidate', className: 'bg-sky-900/60 text-sky-300 border-sky-700' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  checked: { label: 'Checked', className: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  approved_public: { label: 'Approved', className: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  approved_private: { label: 'Private', className: 'bg-purple-900/60 text-purple-300 border-purple-700' },
  rejected: { label: 'Rejected', className: 'bg-red-900/60 text-red-300 border-red-700' },
  duplicate: { label: 'Duplicate', className: 'bg-stone-800 text-stone-400 border-stone-700' },
};

type ActiveMode = 'original' | 'zh' | 'en' | 'seq' | 'side' | 'notes';

interface Props {
  song: Song;
  onClose: () => void;
  autoplay: boolean;
  karaokeMode: boolean;
  onKaraokeToggle: () => void;
}

export default function NowPlaying({ song, onClose, autoplay, karaokeMode, onKaraokeToggle }: Props) {
  const {
    playingTrack, playTrack, isPlaying, pauseTrack, resumeTrack, progress, setIsPanelOpen, seekTo, registerMirrorSeekFn,
  } = usePlayer();
  const playerRef = useRef<any>(null);   // eslint-disable-line @typescript-eslint/no-explicit-any
  const lastMirrorTime = useRef(0);
  // Tracks actual master intent; guards onPlay from YouTube's auto-play after seekMirror(0)
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    // Start this song only when the panel opens for a new song.
    // Do NOT include playingTrack?.id in deps — reacting to external track changes
    // would fight nextTrack() and force the old song to restart.
    if (playingTrack?.id !== song.id) {
      playTrack(song);
    }
    setIsPanelOpen(true);
    return () => setIsPanelOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  // Register this embed as the mirror so PlayerBar seeks can reach it
  useEffect(() => {
    registerMirrorSeekFn((s) => playerRef.current?.seekTo(s, 'seconds'));
    return () => registerMirrorSeekFn(null);
  }, [registerMirrorSeekFn]);

  // Sync the visual mirror with the master audio player on mount
  useEffect(() => {
    if (playerRef.current && progress > 0) {
      playerRef.current.seekTo(progress, 'seconds');
    }
  }, []); // only on mount

  const [activeMode, setActiveMode] = useState<ActiveMode>('original');
  const [showInfo, setShowInfo] = useState(false);

  const title = getDisplayTitle(song);
  const youtubeId = isYouTubeUrl(song.youtube_url) ? getYouTubeId(song.youtube_url!) : null;
  const startTime = song.youtube_url ? getYouTubeStartTime(song.youtube_url) : null;
  const conf = CONFIDENCE_CONFIG[song.confidence] ?? CONFIDENCE_CONFIG.unknown;
  const status = STATUS_CONFIG[song.verification_status] ?? STATUS_CONFIG.candidate;
  const hasLyrics = !!song.lyrics?.show_publicly;
  const romText = song.lyrics?.lyrics_original ?? '';
  const zhText = song.lyrics?.lyrics_translation_zh ?? '';
  const enText = song.lyrics?.lyrics_translation_en ?? '';
  const romLines = romText.split('\n');
  const zhLines = zhText.split('\n');

  const MODE_OPTIONS = [
    { id: 'original' as const, label: song.language_claimed || 'Original', needsLyrics: true,  alwaysDisabled: false },
    { id: 'zh'       as const, label: '中文',     needsLyrics: true,  alwaysDisabled: false },
    { id: 'en'       as const, label: 'EN',       needsLyrics: true,  alwaysDisabled: false },
    { id: 'seq'      as const, label: '≡',        needsLyrics: true,  alwaysDisabled: false },
    { id: 'side'     as const, label: (
        <svg viewBox="0 0 16 10" className="w-4 h-2.5 inline-block" fill="currentColor">
          <rect x="0" y="0" width="7" height="10" rx="1.5" />
          <rect x="9" y="0" width="7" height="10" rx="1.5" />
        </svg>
      ), needsLyrics: true, alwaysDisabled: false },
    { id: 'notes'    as const, label: 'Notes',    needsLyrics: false, alwaysDisabled: true  },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0f0f16] overflow-hidden">

      {/* Embed — hidden in karaoke mode */}
      <div className={karaokeMode ? 'hidden' : 'px-4 pb-3 pt-3'}>
        {youtubeId ? (
          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl relative">
            <ReactPlayer
              ref={playerRef}
              url={song.youtube_url || ''}
              playing={isPlaying}
              muted={true}
              width="100%"
              height="100%"
              controls={true}
              onSeek={(seconds) => seekTo(seconds)}
              onProgress={({ playedSeconds }) => {
                const diff = Math.abs(playedSeconds - lastMirrorTime.current);
                // Jump of >2s not explained by normal playback → user seeked in embed
                if (diff > 2 && Math.abs(playedSeconds - progress) > 2) {
                  seekTo(playedSeconds);
                }
                lastMirrorTime.current = playedSeconds;
              }}
              onPause={() => pauseTrack()}
              onPlay={() => { if (isPlayingRef.current) resumeTrack(); }}
              config={{
                youtube: {
                  playerVars: { autoplay: 1, rel: 0 }
                }
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-video rounded-xl bg-[#1a1a24] flex flex-col items-center justify-center gap-2 border border-white/5">
            <span className="text-4xl text-stone-600" aria-hidden>♪</span>
            <p className="text-stone-600 text-xs">No media available</p>
          </div>
        )}
      </div>

      {/* Title row */}
      <div className="px-4 pb-3 border-b border-white/5">
        <div className="flex items-start gap-2">

          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base leading-tight truncate">{title}</h2>
            {song.title_romanized && song.title_romanized !== title && (
              <p className="text-stone-400 text-xs mt-0.5 truncate">{song.title_romanized}</p>
            )}
            {song.artist && <p className="text-stone-300 text-sm mt-1 font-medium truncate">{song.artist}</p>}
          </div>

          <div className="relative shrink-0 mt-0.5">
            {/* Desktop: info button + tooltip */}
            <button
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Show metadata"
              className="hidden lg:flex w-6 h-6 rounded-full bg-white/8 border border-white/10 items-center justify-center text-[11px] text-stone-400 hover:bg-white/15 hover:text-white transition-colors"
            >ℹ</button>

            {/* Mobile: karaoke toggle */}
            {karaokeMode ? (
              <button
                onClick={onKaraokeToggle}
                aria-label="Exit karaoke mode"
                className="lg:hidden flex flex-col items-center gap-0.5 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <span className="text-xl leading-none">↓</span>
                <span className="text-[8px] font-bold tracking-widest leading-none">VIDEO</span>
              </button>
            ) : (
              <button
                onClick={onKaraokeToggle}
                aria-label="Enter karaoke mode"
                className="lg:hidden flex flex-col items-center gap-0.5 text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span className="text-xl leading-none">🎤</span>
                <span className="text-[8px] font-bold tracking-widest leading-none">KARAOKE</span>
              </button>
            )}

            {showInfo && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowInfo(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 p-3 rounded-xl bg-[#1e1e2c] border border-white/10 shadow-2xl flex flex-wrap gap-1.5 w-52">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${conf.className}`}>{conf.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.className}`}>{status.label}</span>
                  {song.language_claimed && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-stone-800 text-stone-300 border-stone-700">{song.language_claimed}</span>
                  )}
                  {song.ethnic_group_claimed && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-stone-800 text-stone-300 border-stone-700">{song.ethnic_group_claimed}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Single-row mode + notes selector */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/5">
        {MODE_OPTIONS.map((m) => {
          const disabled = m.alwaysDisabled || (m.needsLyrics && !hasLyrics);
          return (
            <button
              key={m.id}
              onClick={() => !disabled && setActiveMode(m.id)}
              disabled={disabled}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-1
                ${activeMode === m.id ? 'bg-white/15 text-white' : 'text-stone-500'}
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:text-stone-300 hover:bg-white/5'}`}
            >{m.label}</button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-3">
        {activeMode === 'notes' ? (
          <div className="space-y-3">
            {[
              { label: 'Language', value: song.language_claimed, note: song.language_evidence },
              { label: 'Ethnic Group', value: song.ethnic_group_claimed, note: song.ethnic_group_evidence },
              { label: 'Region', value: song.region ?? song.location_claimed },
              { label: 'Genre', value: song.genre },
            ].map(({ label, value, note }) => value ? (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-0.5">{label}</p>
                <p className="text-stone-200 text-sm">{value}</p>
                {note && <p className="text-stone-500 text-xs mt-0.5 italic">{note}</p>}
              </div>
            ) : null)}
            {song.verification_notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-0.5">Verification Notes</p>
                <p className="text-stone-400 text-xs italic">{song.verification_notes}</p>
              </div>
            )}
            {song.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {song.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 text-stone-400 text-[10px] border border-white/10">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {song.source_snippets && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-0.5">Source Snippets</p>
                <p className="text-stone-500 text-xs">{song.source_snippets}</p>
              </div>
            )}
          </div>
        ) : !hasLyrics ? (
          <p className="text-stone-600 italic text-sm">
            {song.lyrics && !song.lyrics.show_publicly
              ? 'Lyrics are not available for public display.'
              : 'No lyrics recorded for this song.'}
          </p>
        ) : activeMode === 'original' ? (
          romText
            ? <RomLyrics text={romText} language={song.language_claimed} large={karaokeMode} />
            : <p className="text-stone-600 italic text-sm">No romanization available.</p>
        ) : activeMode === 'zh' ? (
          zhText
            ? <pre className={`whitespace-pre-wrap font-sans text-stone-200 leading-relaxed ${karaokeMode ? 'text-xl text-center' : 'text-sm'}`}>{zhText}</pre>
            : <p className="text-stone-600 italic text-sm">No Chinese translation available.</p>
        ) : activeMode === 'en' ? (
          enText
            ? <pre className={`whitespace-pre-wrap font-sans text-stone-200 leading-relaxed ${karaokeMode ? 'text-xl text-center' : 'text-sm'}`}>{enText}</pre>
            : <p className="text-stone-600 italic text-sm">No English translation available.</p>
        ) : activeMode === 'side' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">Original</p>
              {romText ? <RomLyrics text={romText} language={song.language_claimed} /> : <p className="text-stone-500 text-xs">—</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">中文</p>
              <pre className="whitespace-pre-wrap font-sans text-stone-300 leading-relaxed text-xs">{zhText || '—'}</pre>
            </div>
          </div>
        ) : (
          /* Sequential */
          <div className={`space-y-2 ${karaokeMode ? 'text-center' : ''}`}>
            {romLines.map((line, i) => (
              <div key={i}>
                <div className={karaokeMode ? 'text-xl leading-snug' : 'text-sm leading-snug'}>
                  {line.split(' ').filter(Boolean).map((word, wi) => (
                    <HoverableWord key={wi} word={word} language={song.language_claimed} />
                  ))}
                </div>
                {zhLines[i] && <p className={`text-stone-500 leading-snug mt-0.5 ${karaokeMode ? 'text-base' : 'text-xs'}`}>{zhLines[i]}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
