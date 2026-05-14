import type { LyricsData } from '@/lib/types';

interface LyricsPanelProps {
  lyrics?: LyricsData;
}

function LyricsSection({ heading, content }: { heading: string; content: string }) {
  return (
    <div className="mb-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">{heading}</h4>
      <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 leading-relaxed">{content}</pre>
    </div>
  );
}

export default function LyricsPanel({ lyrics }: LyricsPanelProps) {
  // No lyrics data at all
  if (!lyrics) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Lyrics</h3>
        <p className="text-sm text-stone-500">No lyrics record for this song.</p>
      </div>
    );
  }

  // Lyrics exist but not allowed for public display
  if (!lyrics.show_publicly) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Lyrics</h3>
        <p className="text-sm text-stone-500">
          Lyrics are available in the source link but are not displayed here.
        </p>
        {lyrics.lyrics_notes && (
          <p className="mt-2 text-xs text-stone-400 italic">{lyrics.lyrics_notes}</p>
        )}
      </div>
    );
  }

  // Lyrics are allowed to display
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">Lyrics</h3>

      {lyrics.lyrics_original && (
        <LyricsSection heading="Original" content={lyrics.lyrics_original} />
      )}
      {lyrics.lyrics_romanized && (
        <LyricsSection heading="Romanization" content={lyrics.lyrics_romanized} />
      )}
      {lyrics.lyrics_translation_zh && (
        <LyricsSection heading="Chinese Translation" content={lyrics.lyrics_translation_zh} />
      )}
      {lyrics.lyrics_translation_en && (
        <LyricsSection heading="English Translation" content={lyrics.lyrics_translation_en} />
      )}

      {lyrics.lyrics_source && (
        <p className="mt-3 text-[10px] text-stone-400">Source: {lyrics.lyrics_source}</p>
      )}
    </div>
  );
}
