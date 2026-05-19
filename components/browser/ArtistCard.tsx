'use client';
import type { Artist } from '@/lib/types';

const GROUP_GRADIENT: Record<string, string> = {
  Amis:         'from-amber-700 via-rose-800 to-red-900',
  Bunun:        'from-teal-700 via-emerald-800 to-green-900',
  Paiwan:       'from-violet-700 via-purple-800 to-indigo-900',
  Seediq:       'from-orange-700 via-amber-800 to-yellow-900',
  'Tao (Yami)': 'from-sky-700 via-blue-800 to-cyan-900',
  Atayal:       'from-rose-700 via-pink-800 to-fuchsia-900',
  Rukai:        'from-lime-700 via-green-800 to-teal-900',
};

function getGradient(ethnic_groups: string[]) {
  return GROUP_GRADIENT[ethnic_groups[0] ?? ''] ?? 'from-stone-600 via-stone-700 to-stone-800';
}

interface Props {
  artist: Artist;
  songCount: number;
  isSelected: boolean;
  onClick: () => void;
}

export default function ArtistCard({ artist, songCount, isSelected, onClick }: Props) {
  const gradient = getGradient(artist.ethnic_groups);

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-xl overflow-hidden transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-white/40 shadow-2xl scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-xl'}`}
    >
      {/* Avatar area */}
      <div className={`relative w-full aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        {artist.photo_url ? (
          <img
            src={artist.photo_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-white/30 text-5xl font-bold select-none" aria-hidden>
            {artist.name_display[0]}
          </span>
        )}
        {artist.ethnic_groups[0] && (
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-black/40 backdrop-blur text-white/90 border border-white/20">
            {artist.ethnic_groups[0]}
          </span>
        )}
        {artist.is_group && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/60 backdrop-blur text-sky-300 border border-sky-500/30">
            Group
          </span>
        )}
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/50 backdrop-blur text-white/70 border border-white/15">
          {songCount} {songCount === 1 ? 'song' : 'songs'}
        </span>
      </div>

      {/* Info */}
      <div className="bg-[#1a1a24] group-hover:bg-[#1e1e2a] transition-colors px-3 py-2.5">
        <p className="text-sm font-semibold truncate text-white leading-tight">{artist.name_display}</p>
        <p className="text-stone-400 text-xs truncate mt-0.5">{artist.names_zh[0] ?? ' '}</p>
      </div>
    </button>
  );
}
