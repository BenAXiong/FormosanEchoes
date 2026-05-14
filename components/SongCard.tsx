'use client';

import type { Song } from '@/lib/types';
import { getDisplayTitle, getSecondaryTitle } from '@/lib/normalize';
import VerificationBadge from './VerificationBadge';

interface SongCardProps {
  song: Song;
  isSelected: boolean;
  onSelect: (song: Song) => void;
}

export default function SongCard({ song, isSelected, onSelect }: SongCardProps) {
  const primary = getDisplayTitle(song);
  const secondary = getSecondaryTitle(song);

  return (
    <button
      id={`song-card-${song.id}`}
      onClick={() => onSelect(song)}
      aria-pressed={isSelected}
      aria-label={`Select song: ${primary}`}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 group
        ${isSelected
          ? 'border-formosa-teal bg-formosa-teal/5 shadow-md ring-2 ring-formosa-teal/20'
          : 'border-stone-200 bg-white hover:border-formosa-teal/40 hover:shadow-sm'}`}
    >
      {/* Titles */}
      <div className="mb-1.5">
        <p className={`font-semibold text-sm leading-snug truncate ${isSelected ? 'text-formosa-teal' : 'text-stone-800 group-hover:text-formosa-teal'} transition-colors`}>
          {primary}
        </p>
        {secondary && (
          <p className="text-xs text-stone-500 truncate mt-0.5">{secondary}</p>
        )}
      </div>

      {/* Artist / platform */}
      {(song.artist || song.source_platform) && (
        <p className="text-xs text-stone-600 truncate mb-2">
          {song.artist ?? song.source_platform}
          {song.year ? <span className="text-stone-400"> · {song.year}</span> : null}
        </p>
      )}

      {/* Language + group */}
      <div className="flex flex-wrap gap-1 mb-2">
        {song.language_claimed && (
          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium border border-stone-200">
            {song.language_claimed}
          </span>
        )}
        {song.ethnic_group_claimed && (
          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[10px] font-medium border border-stone-200">
            {song.ethnic_group_claimed}
          </span>
        )}
      </div>

      {/* Tags */}
      {song.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {song.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-formosa-warm/40 text-stone-600 text-[10px] border border-formosa-warm">
              {tag}
            </span>
          ))}
          {song.tags.length > 4 && (
            <span className="text-[10px] text-stone-400">+{song.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Badges */}
      <VerificationBadge
        confidence={song.confidence}
        status={song.verification_status}
        compact
      />

      {/* Lyrics indicator */}
      {song.lyrics?.show_publicly && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-700">
          <span aria-hidden="true">♪</span> Lyrics available
        </span>
      )}
    </button>
  );
}
