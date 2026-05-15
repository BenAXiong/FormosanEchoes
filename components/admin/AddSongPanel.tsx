'use client';
import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftSong = Record<string, unknown> & {
  id: string;
  youtube_url: string;
  title_original?: string;
  title_romanized?: string | null;
  title_chinese?: string | null;
  artist?: string;
  language_claimed?: string | null;
  ethnic_group_claimed?: string | null;
  genre?: string | null;
  year?: string | null;
  album_or_source?: string | null;
  tags?: string[];
  lyrics_original?: string | null;
  lyrics_romanized?: string | null;
  lyrics_translation_zh?: string | null;
  lyrics_translation_en?: string | null;
  lyrics_source?: string | null;
  notes?: string | null;
  _oembed?: { title: string; channel: string; videoId: string };
};

const LANGUAGES = [
  'Amis', 'Atayal', 'Paiwan', 'Bunun', 'Puyuma', 'Rukai', 'Tsou',
  'Saisiyat', 'Tao (Yami)', 'Thao', 'Kavalan', 'Truku', 'Sakizaya',
  'Seediq', "Hla'alua", 'Kanakanavu',
];

const GENRES = [
  'Traditional', 'Traditional Choral', 'Modern Folk', 'Contemporary Folk',
  'Contemporary Indigenous Folk-Pop', 'Indigenous Gospel / Folk',
];

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label, value, onChange, multiline = false, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddSongPanel() {
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<DraftSong | null>(null);
  const [status, setStatus] = useState<'idle' | 'fetching' | 'enriching' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [sources, setSources] = useState<string[]>([]);

  // Generic draft field updater
  const setField = (key: keyof DraftSong, value: unknown) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  // Auto-fetch on URL paste
  useEffect(() => {
    const trimmed = url.trim();
    if (trimmed && (trimmed.includes('youtube.com/') || trimmed.includes('youtu.be/'))) {
      // Small timeout to ensure the paste is complete/valid
      const timer = setTimeout(() => {
        if (status === 'idle' && !draft) {
          handleFetch();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [url]);

  // ── Step 1: Fetch YouTube metadata ─────────────────────────────────────────
  async function handleFetch() {
    if (!url.trim()) return;
    setStatus('fetching');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/fetch-song?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
      setDraft(data.draft);
      setStatus('idle');
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // ── Step 2: Enrich with Gemini ─────────────────────────────────────────────
  async function handleEnrich() {
    if (!draft) return;
    setStatus('enriching');
    setMessage('');
    try {
      const res = await fetch('/api/admin/enrich-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft._oembed?.title ?? draft.title_original ?? '',
          channel: draft._oembed?.channel ?? '',
          youtube_url: draft.youtube_url,
          videoId: draft._oembed?.videoId ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Enrich failed');
      const e = data.enriched;
      if (data.sources?.length) setSources(data.sources);
      // Merge enriched fields into draft — don't overwrite if already set
      setDraft(d => {
        if (!d) return d;
        return {
          ...d,
          title_original:           e.title_original         ?? d.title_original,
          title_romanized:          e.title_romanized        ?? d.title_romanized,
          title_chinese:            e.title_chinese          ?? d.title_chinese,
          artist:                   e.artist                 ?? d.artist,
          language_claimed:         e.language_claimed       ?? d.language_claimed,
          ethnic_group_claimed:     e.ethnic_group_claimed   ?? d.ethnic_group_claimed,
          genre:                    e.genre                  ?? d.genre,
          year:                     e.year                   ?? d.year,
          album_or_source:          e.album_or_source        ?? d.album_or_source,
          lyrics_original:          e.lyrics_original        ?? d.lyrics_original,
          lyrics_romanized:         e.lyrics_romanized       ?? d.lyrics_romanized,
          lyrics_translation_zh:    e.lyrics_translation_zh  ?? d.lyrics_translation_zh,
          lyrics_translation_en:    e.lyrics_translation_en  ?? d.lyrics_translation_en,
          lyrics_source:            e.lyrics_source          ?? d.lyrics_source,
          notes:                    e.notes                  ?? d.notes,
        };
      });
      setStatus('idle');
      setMessage('✓ Gemini enrichment applied — review and edit before saving.');
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // ── Step 3: Save to DB ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft) return;
    setStatus('saving');
    setMessage('');
    try {
      // Build lyrics sub-object if we have lyrics content
      const hasLyrics = !!(draft.lyrics_original || draft.lyrics_translation_zh || draft.lyrics_translation_en);
      const payload = {
        ...draft,
        lyrics: hasLyrics ? {
          song_id: draft.id,
          lyrics_original:          draft.lyrics_original        ?? null,
          lyrics_romanized:         draft.lyrics_romanized       ?? null,
          lyrics_translation_zh:    draft.lyrics_translation_zh  ?? null,
          lyrics_translation_en:    draft.lyrics_translation_en  ?? null,
          lyrics_source:            draft.lyrics_source          ?? null,
          has_permission:           false,
          show_publicly:            false,
        } : null,
        // Clean up flat lyrics fields before saving
        lyrics_original: undefined,
        lyrics_romanized: undefined,
        lyrics_translation_zh: undefined,
        lyrics_translation_en: undefined,
        lyrics_source: undefined,
      };

      const res = await fetch('/api/admin/save-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      const linked = data.artist_linked
        ? `✓ Artist linked to DB.`
        : `⚠ Artist "${draft.artist}" not in DB — added to unlinked queue.`;

      setStatus('saved');
      setMessage(`✓ Song saved. ${linked}`);
      setDraft(null);
      setUrl('');
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Add Song</h2>
        <p className="text-stone-500 text-xs">Paste a YouTube URL to start. Then optionally enrich with Gemini before saving.</p>
      </div>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={handleFetch}
          disabled={status === 'fetching'}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors disabled:opacity-40"
        >
          {status === 'fetching' ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : status === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          {message}
        </div>
      )}

      {/* Draft form */}
      {draft && (
        <>
          {/* YouTube preview */}
          {draft._oembed && (
            <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
              <img
                src={`https://img.youtube.com/vi/${draft._oembed.videoId}/mqdefault.jpg`}
                alt=""
                className="w-24 h-16 object-cover rounded"
              />
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate">{draft._oembed.title}</p>
                <p className="text-stone-500 text-xs mt-0.5">{draft._oembed.channel}</p>
                <a
                  href={draft.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 text-[10px] hover:underline"
                >
                  {draft.youtube_url}
                </a>
              </div>
            </div>
          )}

          {/* Enrich button + sources */}
          <button
            onClick={handleEnrich}
            disabled={status === 'enriching'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-semibold transition-colors disabled:opacity-40 self-start"
          >
            <span>✦</span>
            {status === 'enriching' ? 'Gemini is researching…' : 'Enrich with Gemini'}
          </button>
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sources.slice(0, 5).map((src, i) => {
                const host = (() => { try { return new URL(src).hostname.replace('www.', ''); } catch { return src; } })();
                return (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-white/30 transition-colors truncate max-w-[200px]"
                    title={src}
                  >{host}</a>
                );
              })}
            </div>
          )}

          <div className="h-px bg-white/5" />

          {/* Core metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Title (original)" value={draft.title_original ?? ''} onChange={v => setField('title_original', v)} />
            <Field label="Title (romanized)" value={draft.title_romanized ?? ''} onChange={v => setField('title_romanized', v || null)} />
            <Field label="Title (Chinese)" value={draft.title_chinese ?? ''} onChange={v => setField('title_chinese', v || null)} />
            <Field label="Artist" value={draft.artist ?? ''} onChange={v => setField('artist', v)} />
            <Select label="Language" value={draft.language_claimed ?? ''} onChange={v => setField('language_claimed', v || null)} options={LANGUAGES} />
            <Select label="Ethnic Group" value={draft.ethnic_group_claimed ?? ''} onChange={v => setField('ethnic_group_claimed', v || null)} options={LANGUAGES} />
            <Select label="Genre" value={draft.genre ?? ''} onChange={v => setField('genre', v || null)} options={GENRES} />
            <Field label="Year" value={draft.year ?? ''} onChange={v => setField('year', v || null)} placeholder="e.g. 2019" />
            <Field label="Album / Source" value={draft.album_or_source ?? ''} onChange={v => setField('album_or_source', v || null)} />
            <Field label="Tags (comma-separated)" value={(draft.tags ?? []).join(', ')} onChange={v => setField('tags', v.split(',').map(t => t.trim()).filter(Boolean))} />
          </div>

          {/* Lyrics section */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Lyrics</p>
            <div className="flex flex-col gap-4">
              <Field label="Original (indigenous language)" value={draft.lyrics_original ?? ''} onChange={v => setField('lyrics_original', v || null)} multiline />
              <Field label="Romanized" value={draft.lyrics_romanized ?? ''} onChange={v => setField('lyrics_romanized', v || null)} multiline />
              <Field label="Translation (Traditional Chinese)" value={draft.lyrics_translation_zh ?? ''} onChange={v => setField('lyrics_translation_zh', v || null)} multiline />
              <Field label="Translation (English)" value={draft.lyrics_translation_en ?? ''} onChange={v => setField('lyrics_translation_en', v || null)} multiline />
              <Field label="Lyrics source" value={draft.lyrics_source ?? ''} onChange={v => setField('lyrics_source', v || null)} placeholder="URL or description" />
            </div>
          </div>

          <Field label="Notes" value={draft.notes ?? ''} onChange={v => setField('notes', v || null)} multiline />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={status === 'saving' || !draft.title_original}
            className="px-6 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-bold transition-colors disabled:opacity-40 self-start"
          >
            {status === 'saving' ? 'Saving…' : '✓ Save to DB'}
          </button>
        </>
      )}
    </div>
  );
}
