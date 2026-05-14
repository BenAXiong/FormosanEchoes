import type { Song } from '@/lib/types';
import { getDisplayTitle, getSecondaryTitle } from '@/lib/normalize';
import VerificationBadge from './VerificationBadge';
import SourceLinks from './SourceLinks';
import MediaEmbed from './MediaEmbed';
import LyricsPanel from './LyricsPanel';

interface SongDetailPanelProps {
  song: Song;
}

function EvidenceRow({ label, claim, evidence }: { label: string; claim?: string; evidence?: string }) {
  if (!claim) return null;
  return (
    <div className="py-2 border-b border-stone-100 last:border-0">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 w-24 shrink-0 pt-0.5">{label}</span>
        <div>
          <p className="text-sm text-stone-700">{claim}</p>
          {evidence && <p className="text-xs text-stone-500 mt-0.5 italic">{evidence}</p>}
        </div>
      </div>
    </div>
  );
}

export default function SongDetailPanel({ song }: SongDetailPanelProps) {
  const primary = getDisplayTitle(song);
  const secondary = getSecondaryTitle(song);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-800 leading-tight">{primary}</h2>
        {secondary && <p className="text-sm text-stone-500 mt-0.5">{secondary}</p>}
        {song.artist && (
          <p className="text-sm text-stone-600 mt-1 font-medium">{song.artist}</p>
        )}
        {(song.year || song.album_or_source) && (
          <p className="text-xs text-stone-400 mt-0.5">
            {[song.year, song.album_or_source].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Badges */}
      <VerificationBadge confidence={song.confidence} status={song.verification_status} />

      {/* Media */}
      <MediaEmbed
        youtube_url={song.youtube_url}
        url={song.url}
        source_platform={song.source_platform}
        title={primary}
      />

      {/* Source links */}
      <SourceLinks
        url={song.url}
        youtube_url={song.youtube_url}
        lyrics_url={song.lyrics_url}
        source_platform={song.source_platform}
      />

      {/* Tags */}
      {song.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {song.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-full bg-formosa-warm/50 text-stone-600 text-xs border border-formosa-warm">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Evidence section */}
      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
        <div className="px-4 py-2 bg-stone-50">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Evidence & Metadata</h3>
        </div>
        <div className="px-4">
          <EvidenceRow label="Language" claim={song.language_claimed} evidence={song.language_evidence} />
          <EvidenceRow label="Ethnic Group" claim={song.ethnic_group_claimed} evidence={song.ethnic_group_evidence} />
          <EvidenceRow label="Region" claim={song.region ?? song.location_claimed} />
          <EvidenceRow label="Genre" claim={song.genre} />
          {song.verification_notes && (
            <div className="py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Verification Notes</p>
              <p className="text-xs text-stone-600 italic">{song.verification_notes}</p>
            </div>
          )}
          {song.source_snippets && (
            <div className="py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Source Snippets</p>
              <p className="text-xs text-stone-500">{song.source_snippets}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lyrics */}
      <LyricsPanel lyrics={song.lyrics} />
    </div>
  );
}
