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
  onOpenMenu?: (song: Song, rect: DOMRect) => void;
  onOpenMenuAtPlaylists?: (song: Song, rect: DOMRect) => void;
}

export default function SongCard({ song, isSelected, isPlaying, onSelect, compact = false, artistMap, showSongZh = true, showArtistZh = false, onArtistClick, onOpenMenu, onOpenMenuAtPlaylists }: Props) {
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
        <div className={`relative shrink-0 w-11 h-11 rounded-md overflow-hidden bg-linear-to-br ${gradient}`}>
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
            ) : (
              <span className="text-white text-xs pl-0.5" aria-hidden>▶</span>
            )}
          </div>

          {/* Lyrics badge — top left */}
          {song.lyrics?.show_publicly && (
            <span className="absolute top-1 left-1 z-10 text-emerald-400 text-[8px] leading-none bg-black/50 rounded px-1 py-0.5" aria-label="Has lyrics">♪</span>
          )}

          {/* Fav Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(song.id); }}
            className={`absolute top-1 right-1 transition-all duration-200 z-10
              ${isFavorite(song.id) ? 'opacity-100 text-emerald-500 scale-110' : 'text-white/40 hover:text-white opacity-100'}`}
            aria-label={isFavorite(song.id) ? 'Unlike' : 'Like'}
          >
            <svg className="w-4 h-4" fill={isFavorite(song.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isPlaying ? 'text-emerald-500' : 'text-white'} ${titleFallback ? 'italic' : ''}`}>
            {title}{showSongZh && song.title_chinese ? <span className="ml-1.5 text-stone-500 font-normal text-xs not-italic">({song.title_chinese})</span> : null}
          </p>
          {onArtistClick && song.artist_ids?.length ? (
            <button
              onClick={e => { e.stopPropagation(); onArtistClick(song.artist_ids![0]); }}
              className="text-stone-400 text-xs truncate mt-0.5 hover:text-stone-200 transition-colors text-left w-full"
            >{artist}</button>
          ) : (
            <p className="text-stone-400 text-xs truncate mt-0.5">{artist}</p>
          )}
        </div>

        {/* Song menu */}
        {onOpenMenu && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMenu(song, e.currentTarget.getBoundingClientRect()); }}
            className="shrink-0 p-2 -mr-1 text-stone-600 hover:text-stone-300 transition-colors"
            aria-label="More options"
          >
            <svg className="w-1.5 h-4" fill="currentColor" viewBox="0 0 6 16" aria-hidden>
              <circle cx="3" cy="2" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="3" cy="14" r="1.5"/>
            </svg>
          </button>
        )}
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
      <div className={`relative w-full aspect-square bg-linear-to-br ${gradient} flex items-end p-3`}>
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

        {/* Playlist Add */}
        {onOpenMenuAtPlaylists && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMenuAtPlaylists(song, e.currentTarget.getBoundingClientRect()); }}
            className="absolute top-2 left-2 z-10 w-7 h-7 rounded-md bg-black/60 flex items-center justify-center text-stone-400 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Add to playlist"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4.5L5 21V5z"/>
            </svg>
          </button>
        )}

        {/* Fav Toggle (Normal) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(song.id);
          }}
          className={`absolute top-4 right-4 transition-all duration-200 z-10
            ${isFavorite(song.id) ? 'text-emerald-500 scale-110 drop-shadow-lg' : 'text-white/40 hover:text-white opacity-100'}`}
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
          <div className="absolute bottom-2.5 right-2.5 z-10 w-6 h-6 rounded bg-black/60 backdrop-blur flex items-center justify-center border border-emerald-500/20" aria-label="Has lyrics">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="0.5" y="3" width="9" height="1.2" rx="0.6"/>
              <rect x="0.5" y="6.4" width="9" height="1.2" rx="0.6"/>
              <rect x="0.5" y="9.8" width="5.5" height="1.2" rx="0.6"/>
              <rect x="13.2" y="2" width="1" height="7.5" rx="0.5"/>
              <ellipse cx="12" cy="10" rx="2" ry="1.4" transform="rotate(-20 12 10)"/>
            </svg>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="bg-[#1a1a24] group-hover:bg-[#1e1e2a] transition-colors px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate leading-tight ${isPlaying ? 'text-emerald-500' : 'text-white'} ${titleFallback ? 'italic' : ''}`}>{title}</p>
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
