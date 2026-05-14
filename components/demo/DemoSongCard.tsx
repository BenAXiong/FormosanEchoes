import type { Song } from '@/lib/types';
import { getYouTubeId, isYouTubeUrl } from '@/lib/normalize';

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

// Map genre to colors (you can refine these as you populate more data)
const GENRE_DOT: Record<string, string> = {
  'Traditional': 'bg-blue-400',
  'Traditional Choral': 'bg-blue-300',
  'Modern Folk': 'bg-amber-400',
  'Contemporary Folk': 'bg-amber-400',
  'Contemporary Indigenous Folk-Pop': 'bg-fuchsia-400',
  'Indigenous Gospel / Folk': 'bg-rose-400',
};

function getGenreDot(genre?: string | null) {
  if (!genre) return 'bg-stone-600'; // Default gray for unknown/unclassified
  return GENRE_DOT[genre] || 'bg-stone-400';
}

interface Props {
  song: Song;
  isSelected: boolean;
  onSelect: (song: Song) => void;
}

export default function DemoSongCard({ song, isSelected, onSelect }: Props) {
  const gradient = getLangGradient(song.language_claimed);
  const title = song.title_original ?? song.title_romanized ?? song.title_chinese ?? '(Untitled)';
  const zhTitle = song.title_chinese ? `(${song.title_chinese})` : '()';
  const artist = song.artist || 'Unknown artist';
  const ytId = isYouTubeUrl(song.youtube_url) ? getYouTubeId(song.youtube_url!) : null;
  const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;

  return (
    <button
      id={`demo-card-${song.id}`}
      onClick={() => onSelect(song)}
      aria-pressed={isSelected}
      className={`group w-full text-left rounded-xl overflow-hidden transition-all duration-200
        ${isSelected ? 'ring-2 ring-white/40 shadow-2xl scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-xl'}`}
    >
      {/* Artwork area */}
      <div className={`relative w-full aspect-square bg-gradient-to-br ${gradient} flex items-end p-3`}>
        {/* YouTube thumbnail */}
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {/* Music icon (shown when no thumb) */}
        {!thumbUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10 text-white text-7xl select-none" aria-hidden>♪</div>
        )}
        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/30
          transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30 shadow-lg">
            <span className="text-white text-lg pl-1" aria-hidden>▶</span>
          </div>
        </div>
        {/* Language badge (Top Left) */}
        {song.language_claimed && (
          <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/40 backdrop-blur text-white/90 border border-white/20">
            {song.language_claimed}
          </span>
        )}
        
        {/* Lyrics badge (Bottom Right) */}
        {song.lyrics?.show_publicly && (
          <span className="absolute bottom-3 right-3 z-10 px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider bg-black/60 backdrop-blur text-emerald-400 border border-emerald-500/30">
            ♪ Lyrics
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="bg-[#1a1a24] group-hover:bg-[#1e1e2a] transition-colors px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getGenreDot(song.genre)}`} title={`Type: ${song.genre || 'Unknown'}`} />
          <p className="text-white text-sm font-semibold truncate leading-tight">{title}</p>
        </div>
        <div className="pl-3.5">
          <p className="text-stone-400 text-xs truncate mt-0.5">{zhTitle}</p>
          <p className="text-stone-300 text-xs font-medium truncate mt-1.5">{artist}</p>
        </div>
      </div>
    </button>
  );
}
