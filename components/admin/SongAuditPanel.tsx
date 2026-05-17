'use client';
import { useState, useEffect, useRef } from 'react';
import { getYouTubeId } from '@/lib/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  'Amis', 'Atayal', 'Paiwan', 'Bunun', 'Puyuma', 'Rukai', 'Tsou',
  'Saisiyat', 'Tao (Yami)', 'Thao', 'Kavalan', 'Truku', 'Sakizaya',
  'Seediq', "Hla'alua", 'Kanakanavu',
];

const GENRES = [
  'Traditional', 'Traditional Choral', 'Modern Folk', 'Contemporary Folk',
  'Contemporary Indigenous Folk-Pop', 'Indigenous Gospel / Folk',
];

const RECORDING_TYPES = ['Studio', 'Live', 'Home Recording', 'Field Recording'];

// ─── Types ────────────────────────────────────────────────────────────────────

type UnauditedSong = {
  id: string;
  title: string;
  title_original: string | null;
  title_zh: string | null;
  artist_credit: string;
  yt_url: string;
  yt_video_id: string | null;
  language: string | null;
  ethnic_group: string | null;
  genre: string | null;
  recording_type: string | null;
  year: string | null;
  album: string | null;
  description: string | null;
  notes: string | null;
  lyrics_original: string | null;
  lyrics_zh: string | null;
  lyrics_en: string | null;
  missing: string[];
};

type DraftForm = {
  title_original: string;
  title_zh: string;
  artist_credit: string;
  language: string;
  ethnic_group: string;
  genre: string;
  recording_type: string;
  year: string;
  album: string;
  description: string;
  notes: string;
  lyrics_original: string;
  lyrics_zh: string;
  lyrics_en: string;
  lyrics_source: string;
};

function draftFromSong(s: UnauditedSong): DraftForm {
  return {
    title_original: s.title_original ?? '',
    title_zh:       s.title_zh       ?? '',
    artist_credit:  s.artist_credit  ?? '',
    language:       s.language       ?? '',
    ethnic_group:   s.ethnic_group   ?? '',
    genre:          s.genre          ?? '',
    recording_type: s.recording_type ?? '',
    year:           s.year           ?? '',
    album:          s.album          ?? '',
    description:    s.description    ?? '',
    notes:          s.notes          ?? '',
    lyrics_original: s.lyrics_original ?? '',
    lyrics_zh:       s.lyrics_zh       ?? '',
    lyrics_en:       s.lyrics_en       ?? '',
    lyrics_source:   '',
  };
}

function mergeEnriched(base: DraftForm, e: Record<string, string | null>): DraftForm {
  return {
    ...base,
    title_original:  e.title_original        ?? base.title_original,
    title_zh:        e.title_chinese          ?? base.title_zh,
    language:        e.language_claimed       ?? base.language,
    ethnic_group:    e.ethnic_group_claimed   ?? base.ethnic_group,
    genre:           e.genre                  ?? base.genre,
    recording_type:  e.recording_type         ?? base.recording_type,
    year:            e.year                   ?? base.year,
    album:           e.album_or_source        ?? base.album,
    notes:           e.notes                  ?? base.notes,
    lyrics_original: e.lyrics_original        ?? base.lyrics_original,
    lyrics_zh:       e.lyrics_translation_zh  ?? base.lyrics_zh,
    lyrics_en:       e.lyrics_translation_en  ?? base.lyrics_en,
    lyrics_source:   e.lyrics_source          ?? base.lyrics_source,
  };
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline = false, placeholder }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}>) {
  const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} className={cls} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}

function SelectField({ label, value, onChange, options }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; options: string[];
}>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors">
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MissingTag({ label }: Readonly<{ label: string }>) {
  const isUnapproved = label === 'lyrics_unapproved';
  const cls = isUnapproved
    ? 'bg-blue-900/40 text-blue-400 border-blue-700/40'
    : 'bg-orange-900/40 text-orange-400 border-orange-700/40';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap ${cls}`}>
      {isUnapproved ? 'lyrics' : label}
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SongAuditPanel() {
  const [songs, setSongs]         = useState<UnauditedSong[]>([]);
  const [loading, setLoading]     = useState(false);
  const [listMessage, setListMessage] = useState('');

  const [selected, setSelected]   = useState<UnauditedSong | null>(null);
  const [draft, setDraft]         = useState<DraftForm | null>(null);
  const [panelStatus, setPanelStatus] = useState<'idle' | 'enriching' | 'saving' | 'saved' | 'error'>('idle');
  const [panelMessage, setPanelMessage] = useState('');
  const [sources, setSources]     = useState<string[]>([]);

  const [showUnapproved, setShowUnapproved] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const abortRef = useRef(false);
  const enrichAbortRef = useRef<AbortController | null>(null);

  const setField = (key: keyof DraftForm, value: string) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  async function fetchUnaudited() {
    setLoading(true);
    setListMessage('');
    try {
      const res  = await fetch('/api/admin/unaudited-songs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSongs(Array.isArray(data) ? data : []);
    } catch (err) {
      setListMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchUnaudited(); }, []);

  function selectSong(song: UnauditedSong) {
    setSelected(song);
    setDraft(draftFromSong(song));
    setPanelStatus('idle');
    setPanelMessage('');
    setSources([]);
  }

  async function enrichSong(song: UnauditedSong) {
    enrichAbortRef.current?.abort();
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    setSelected(song);
    setDraft(draftFromSong(song));
    setSources([]);
    setPanelStatus('enriching');
    setPanelMessage('');
    try {
      const videoId = getYouTubeId(song.yt_url) ?? '';
      const res = await fetch('/api/admin/enrich-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: song.title, youtube_url: song.yt_url, videoId }),
      });
      // Ignore result if the user stopped this enrichment
      if (controller.signal.aborted) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Enrichment failed');
      if (json.sources?.length) setSources(json.sources as string[]);
      setDraft(mergeEnriched(draftFromSong(song), json.enriched as Record<string, string | null>));
      setPanelStatus('idle');
      setPanelMessage('✓ Gemini enrichment applied — review and edit before saving.');
    } catch (err) {
      if (controller.signal.aborted) return;
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Enrichment failed');
    }
  }

  function stopEnrich() {
    enrichAbortRef.current?.abort();
    enrichAbortRef.current = null;
    setPanelStatus('idle');
    setPanelMessage('');
  }

  async function saveSelected() {
    if (!selected || !draft) return;
    setPanelStatus('saving');
    setPanelMessage('');
    try {
      const res = await fetch('/api/admin/update-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: selected.id, fields: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setPanelStatus('saved');
      setPanelMessage('✓ Saved.');
      setSongs(prev => prev.filter(s => s.id !== selected.id));
      setSelected(null);
      setDraft(null);
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleBatchEnrich() {
    abortRef.current = false;
    setBatchRunning(true);
    for (const song of visibleSongs) {
      if (abortRef.current) break;
      setListMessage(`Enriching "${song.title}"…`);
      try {
        const videoId = getYouTubeId(song.yt_url) ?? '';
        const enrichRes = await fetch('/api/admin/enrich-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: song.title, youtube_url: song.yt_url, videoId }),
        });
        const enrichJson = await enrichRes.json();
        if (!enrichRes.ok) continue;
        await fetch('/api/admin/update-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: song.id, enriched: enrichJson.enriched }),
        });
      } catch { /* skip failures */ }
      await new Promise(r => setTimeout(r, 400));
    }
    setListMessage('');
    setBatchRunning(false);
    fetchUnaudited();
  }

  const visibleSongs = showUnapproved
    ? songs
    : songs.filter(s => s.missing.some(m => m !== 'lyrics_unapproved'));

  const thumbId = selected?.yt_video_id ?? (selected ? getYouTubeId(selected.yt_url) : null);

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-lg mb-1">Edit Songs</h2>
          <p className="text-stone-500 text-xs">
            Songs missing language, ethnic group, or lyrics. Click a row to edit; ✦ to enrich with Gemini.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {listMessage && <span className="text-stone-500 text-xs italic truncate max-w-50">{listMessage}</span>}
          {batchRunning
            ? (
              <button onClick={() => { abortRef.current = true; setBatchRunning(false); }}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors">
                ✕ Stop
              </button>
            ) : (
              <button onClick={handleBatchEnrich} disabled={songs.length === 0}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40">
                ✦ Enrich All ({visibleSongs.length})
              </button>
            )
          }
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

        {/* ── Left: song list ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">
              Needs Audit ({visibleSongs.length})
            </p>
            <button
              onClick={() => setShowUnapproved(v => !v)}
              className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                showUnapproved
                  ? 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                  : 'bg-white/5 border-white/10 text-stone-500 hover:text-stone-300'
              }`}
            >
              {showUnapproved ? '✓ ' : ''}lyrics not public
            </button>
          </div>
          {loading && <p className="text-stone-600 text-xs italic">Loading…</p>}
          {!loading && visibleSongs.length === 0 && <p className="text-emerald-500 text-xs font-semibold">✓ All songs audited!</p>}
          {!loading && visibleSongs.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
              {visibleSongs.map(song => (
                <div
                  key={song.id}
                  className={`flex items-center gap-2 px-3 py-2 transition-colors border-l-2 ${
                    selected?.id === song.id
                      ? 'bg-white/10 border-violet-500'
                      : 'hover:bg-white/2 border-transparent'
                  }`}
                >
                  <button
                    onClick={() => selectSong(song)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <div className="flex flex-col gap-0.5 shrink-0">
                      {song.missing.map(m => <MissingTag key={m} label={m} />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-medium truncate">{song.title}</p>
                      <p className="text-stone-600 text-[10px] truncate">{song.artist_credit || '—'}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => void enrichSong(song)}
                    disabled={batchRunning}
                    title="Enrich with Gemini"
                    className="px-2 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors disabled:opacity-40 shrink-0"
                  >
                    ✦
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: editor ── */}
        {selected ? (
          <div className="flex flex-col gap-5">

            {/* YouTube preview */}
            {thumbId && (
              <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
                <img
                  src={`https://img.youtube.com/vi/${thumbId}/mqdefault.jpg`}
                  alt=""
                  className="w-24 h-16 object-cover rounded shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{selected.title}</p>
                  <p className="text-stone-500 text-xs mt-0.5">{selected.artist_credit || '—'}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {selected.missing.map(m => <MissingTag key={m} label={m} />)}
                  </div>
                  <a href={selected.yt_url} target="_blank" rel="noopener noreferrer"
                    className="text-sky-400 text-[10px] hover:underline mt-1 block truncate">
                    {selected.yt_url}
                  </a>
                </div>
              </div>
            )}

            {/* Enrich button + sources */}
            <div className="flex items-center gap-2 flex-wrap">
              {panelStatus === 'enriching' ? (
                <button
                  onClick={stopEnrich}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm font-semibold transition-colors"
                >
                  ✕ Stop
                </button>
              ) : (
                <button
                  onClick={() => void enrichSong(selected)}
                  disabled={batchRunning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  <span>✦</span>
                  Enrich with Gemini
                </button>
              )}
              {sources.slice(0, 5).map(src => {
                let host = src;
                try { host = new URL(src).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
                return (
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-white/30 transition-colors truncate max-w-40"
                    title={src}>
                    {host}
                  </a>
                );
              })}
            </div>

            {/* Panel message */}
            {panelMessage && (() => {
              const cls =
                panelStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                panelStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                'bg-blue-500/10 border-blue-500/30 text-blue-300';
              return (
                <div className={`text-xs px-3 py-2 rounded-lg border ${cls}`}>
                  {panelMessage}
                </div>
              );
            })()}

            <div className="h-px bg-white/5" />

            {/* Form */}
            {draft && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Title (original)"  value={draft.title_original}  onChange={v => setField('title_original', v)} />
                  <Field label="Title (Chinese)"   value={draft.title_zh}        onChange={v => setField('title_zh', v)} />
                  <Field label="Artist credit"     value={draft.artist_credit}   onChange={v => setField('artist_credit', v)} />
                  <Field label="Year"              value={draft.year}            onChange={v => setField('year', v)} placeholder="e.g. 2019" />
                  <SelectField label="Language"    value={draft.language}        onChange={v => setField('language', v)}    options={LANGUAGES} />
                  <SelectField label="Ethnic group" value={draft.ethnic_group}   onChange={v => setField('ethnic_group', v)} options={LANGUAGES} />
                  <SelectField label="Genre"       value={draft.genre}           onChange={v => setField('genre', v)}       options={GENRES} />
                  <SelectField label="Performance" value={draft.recording_type}  onChange={v => setField('recording_type', v)} options={RECORDING_TYPES} />
                  <div className="sm:col-span-2">
                    <Field label="Album / Source"  value={draft.album}           onChange={v => setField('album', v)} />
                  </div>
                </div>

                <Field label="Description (public)" value={draft.description} onChange={v => setField('description', v)} multiline
                  placeholder="Public-facing context shown to visitors" />

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Lyrics</p>
                  <div className="flex flex-col gap-4">
                    <Field label="Original"            value={draft.lyrics_original} onChange={v => setField('lyrics_original', v)} multiline />
                    <Field label="Chinese translation"  value={draft.lyrics_zh}       onChange={v => setField('lyrics_zh', v)}       multiline />
                    <Field label="English translation"  value={draft.lyrics_en}       onChange={v => setField('lyrics_en', v)}       multiline />
                    <Field label="Lyrics source"        value={draft.lyrics_source}   onChange={v => setField('lyrics_source', v)}   placeholder="URL or description" />
                  </div>
                </div>

                <Field label="Notes" value={draft.notes} onChange={v => setField('notes', v)} multiline />

                <button
                  onClick={() => void saveSelected()}
                  disabled={panelStatus === 'saving' || panelStatus === 'enriching'}
                  className="px-6 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-bold transition-colors disabled:opacity-40 self-start"
                >
                  {panelStatus === 'saving' ? 'Saving…' : '✓ Save Changes'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="h-64 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-stone-600 text-sm italic">
            Select a song to review and edit
          </div>
        )}
      </div>
    </div>
  );
}
