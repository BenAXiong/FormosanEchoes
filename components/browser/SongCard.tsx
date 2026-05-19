'use client';
import type { Song, Artist } from '@/lib/types';
import { getYouTubeId, isYouTubeUrl, getDisplayTitle, isTitleFallback } from '@/lib/normalize';
import { usePlayer } from '@/lib/PlayerContext';

const CJK = /[一-鿿]/;

function resolveArtistName(song: Song, artistMap: Map<string, Artist> | undefined, showZh: boolean): string {
  if (artistMap && song.artist_ids?.length) {
    const names = song.artist_ids
      .map(id => {
        const a = artistMap.get(id);
        if (!a) return null;
        const rom = CJK.test(a.name_display) ? (a.names_en[0] ?? a.name_display) : a.name_display;
        const zh  = a.names_zh[0];
        return showZh && zh ? `${rom} (${zh})` : rom;
      })
      .filter((n): n is string => !!n);
    if (names.length) return names.join(' · ');
  }
  return song.artist || 'Unknown artist';
}

const LANG_GRADIENT: Record<string, string> = {
  Amis: 'from-amber-700 via-rose-800 to-red-900',
  Bunun: 'from-teal-700 via-emerald-800 to-green-900',
  Paiwan: 'from-violet-700 via-purple-800 to-indigo-900',
  Seediq: 'from-orange-700 via-amber-800 to-yellow-900',
  'Tao (Yami)': 'from-sky-700 via-blue-800 to-cyan-900',
  Atayal: 'from-rose-700 via-pink-800 to-fuchsia-900',
  Rukai: 'from-lime-700 via-green-800 to-teal-900',
};

function getLangGradient(lang?: string) {
  if (!lang) return 'from-stone-600 via-stone-700 to-stone-800';
  return LANG_GRADIENT[lang] ?? 'from-stone-600 via-stone-700 to-stone-800';
}

function GenreIcon({ genre, className }: Readonly<{ genre?: string | null; className?: string }>) {
  const cls = `inline-block shrink-0 ${className ?? 'w-3 h-3 text-stone-400'}`;
  switch (genre) {
    case 'Traditional':
      // Solid upward triangle — ancient, timeless
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden><polygon points="6,1 11.5,11 0.5,11"/></svg>;
    case 'Traditional Choral':
      // Three vertical bars — choir standing together
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <rect x="0.5" y="2" width="2.5" height="8" rx="1.25"/>
        <rect x="4.75" y="2" width="2.5" height="8" rx="1.25"/>
        <rect x="9" y="2" width="2.5" height="8" rx="1.25"/>
      </svg>;
    case 'Modern Folk':
      // Single quarter note
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <circle cx="3.5" cy="9.5" r="2.5"/>
        <rect x="5.7" y="0.5" width="1.5" height="9.3"/>
      </svg>;
    case 'Contemporary Folk':
      // Two beamed eighth notes
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <circle cx="2.5" cy="9.5" r="2"/>
        <circle cx="8.5" cy="8.5" r="2"/>
        <rect x="4.2" y="1.5" width="1.2" height="8.2"/>
        <rect x="10.1" y="1.5" width="1.2" height="7.2"/>
        <rect x="4.2" y="1.5" width="7.1" height="1.5"/>
      </svg>;
    case 'Contemporary Indigenous Folk-Pop':
      // Four-pointed star / sparkle
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <path d="M6 0 L7.1 4.9 L12 6 L7.1 7.1 L6 12 L4.9 7.1 L0 6 L4.9 4.9 Z"/>
      </svg>;
    case 'Indigenous Gospel / Folk':
      // Cross
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden>
        <rect x="4.5" y="0" width="3" height="12" rx="1.5"/>
        <rect x="0" y="3.5" width="12" height="3" rx="1.5"/>
      </svg>;
    default:
      // Small filled circle for unknown
      return <svg className={cls} viewBox="0 0 12 12" fill="currentColor" aria-hidden><circle cx="6" cy="6" r="3"/></svg>;
  }
}

interface Props {
  song: Song;
  isSelected: boolean;
  isPlaying?: boolean;
  onSelect: (song: Song) => void;
  compact?: boolean;
  artistMap?: Map<string, Artist>;
  showSongZh?: boolean;
  showArtistZh?: boolean;
  onArtistClick?: (artistId: string) => void;
}

export default function SongCard({ song, isSelected, isPlaying, onSelect, compact = false, artistMap, showSongZh = true, showArtistZh = false, onArtistClick }: Props) {
  const { isPlaying: globalIsPlaying, togglePlay, toggleFavorite, isFavorite } = usePlayer();
  const gradient = getLangGradient(song.language_claimed);
  const title = getDisplayTitle(song);
  const titleFallback = isTitleFallback(song);
  const zhTitle = song.title_chinese || ' ';
  const artist = resolveArtistName(song, artistMap, showArtistZh);
  const ytId = isYouTubeUrl(song.youtube_url) ? getYouTubeId(song.youtube_url!) : null;
  const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;

  // ── Compact / list row layout ────────────────────────────────────────
  if (compact) {
    return (
      <div
        id={`song-card-${song.id}`}
        onClick={(e) => {
          if (isPlaying) {
            togglePlay();
          } else {
            onSelect(song);
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        className={`group w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer
          ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
      >
        {/* Square thumbnail */}
        <div className={`relative shrink-0 w-11 h-11 rounded-md overflow-hidden bg-gradient-to-br ${gradient}`}>
          {thumbUrl && (
            <img
              src={thumbUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {!thumbUrl && (
            <span className="absolute inset-0 flex items-center justify-center text-white/20 text-xl" aria-hidden>♪</span>
          )}
          {/* play overlay */}
          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-150
            ${isSelected || isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {isPlaying && globalIsPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : isPlaying && !globalIsPlaying ? (
              <span className="text-white text-xs pl-0.5" aria-hidden>▶</span>
            ) : (
              <span className="text-white text-xs pl-0.5" aria-hidden>▶</span>
            )}
          </div>

          {/* Fav Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(song.id);
            }}
            className={`absolute top-1.5 right-1.5 transition-all duration-200 z-10
              ${isFavorite(song.id) ? 'text-emerald-500 scale-110' : 'text-white/40 hover:text-white opacity-0 group-hover:opacity-100'}`}
          >
            <svg className="w-4 h-4" fill={isFavorite(song.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isPlaying ? 'text-emerald-500' : 'text-white'} ${titleFallback ? 'italic' : ''}`}>{title}</p>
          {onArtistClick && song.artist_ids?.length ? (
            <button
              onClick={e => { e.stopPropagation(); onArtistClick(song.artist_ids![0]); }}
              className="text-stone-400 text-xs truncate mt-0.5 hover:text-stone-200 transition-colors text-left w-full"
            >{artist}</button>
          ) : (
            <p className="text-stone-400 text-xs truncate mt-0.5">{artist}</p>
          )}
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1.5 shrink-0">
          {song.lyrics?.show_publicly && (
            <span className="text-emerald-500 text-[10px]" title="Has lyrics">♪</span>
          )}
          <GenreIcon genre={song.genre} className="w-3 h-3 text-stone-400 shrink-0" />
        </div>
      </div>
    );
  }

  // ── Default card layout ──────────────────────────────────────────────
  return (
    <div
      id={`song-card-${song.id}`}
      onClick={(e) => {
        if (isPlaying) {
          togglePlay();
        } else {
          onSelect(song);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={`group w-full text-left rounded-xl overflow-hidden transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-white/40 shadow-2xl scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-xl'}`}
    >
      {/* Artwork area */}
      <div className={`relative w-full aspect-square bg-gradient-to-br ${gradient} flex items-end p-3`}>
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {!thumbUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 text-white text-7xl select-none" aria-hidden>♪</div>
        )}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/30
          transition-opacity duration-150 ${isSelected || isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30 shadow-lg">
            {isPlaying && globalIsPlaying ? (
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <span className="text-white text-lg pl-1" aria-hidden>▶</span>
            )}
          </div>
        </div>

        {/* Fav Toggle (Normal) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(song.id);
          }}
          className={`absolute top-4 right-4 transition-all duration-200 z-10
            ${isFavorite(song.id) ? 'text-emerald-500 scale-110 drop-shadow-lg' : 'text-white/40 hover:text-white opacity-0 group-hover:opacity-100'}`}
        >
          <svg className="w-6 h-6" fill={isFavorite(song.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {song.language_claimed && (
          <span className="absolute bottom-3 left-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/40 backdrop-blur text-white/90 border border-white/20">
            {song.language_claimed}
          </span>
        )}
        {song.lyrics?.show_publicly && (
          <span className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider bg-black/60 backdrop-blur text-emerald-400 border border-emerald-500/30">
            ♪ Lyrics
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="bg-[#1a1a24] group-hover:bg-[#1e1e2a] transition-colors px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate leading-tight ${isPlaying ? 'text-emerald-500' : 'text-white'} ${titleFallback ? 'italic' : ''}`}>{title}</p>
          <GenreIcon genre={song.genre} className="w-3 h-3 text-stone-400 shrink-0" />
        </div>
        <div className="pl-0">
          {showSongZh && <p className="text-stone-400 text-xs truncate mt-0.5">{zhTitle}</p>}
          {onArtistClick && song.artist_ids?.length ? (
            <button
              onClick={e => { e.stopPropagation(); onArtistClick(song.artist_ids![0]); }}
              className={`text-stone-300 text-xs font-medium truncate hover:text-white transition-colors text-left w-full ${showSongZh ? 'mt-1.5' : 'mt-0.5'}`}
            >{artist}</button>
          ) : (
            <p className={`text-stone-300 text-xs font-medium truncate ${showSongZh ? 'mt-1.5' : 'mt-0.5'}`}>{artist}</p>
          )}
        </div>
      </div>
    </div>
  );
}
