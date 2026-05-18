'use client';
import { useState, useEffect, useRef } from 'react';
import { getYouTubeId } from '@/lib/normalize';
import AddMultipleSongsPanel from '@/components/admin/AddMultipleSongsPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

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
const VERIFICATION_STATUSES = [
  'candidate', 'needs_review', 'checked', 'approved_public', 'approved_private', 'rejected', 'duplicate',
];

const SCROLLBAR = '[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20';

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSong = {
  id: string;
  title: string;
  yt_title: string | null;
  title_original: string | null;
  title_zh: string | null;
  title_en: string | null;
  artist_credit: string;
  yt_url: string;
  yt_video_id: string | null;
  url: string | null;
  language: string | null;
  ethnic_group: string | null;
  region: string | null;
  location: string | null;
  genre: string | null;
  recording_type: string | null;
  year: string | null;
  album: string | null;
  description: string | null;
  notes: string | null;
  verification_status: string | null;
  tags: string[];
  lyrics_original: string | null;
  lyrics_zh: string | null;
  lyrics_en: string | null;
  lyrics_show_publicly: boolean;
  missing: string[];
};

type DraftForm = {
  yt_title: string;
  title_original: string;
  title_zh: string;
  title_en: string;
  artist_credit: string;
  url: string;
  language: string;
  ethnic_group: string;
  region: string;
  location: string;
  genre: string;
  recording_type: string;
  year: string;
  album: string;
  description: string;
  notes: string;
  verification_status: string;
  tags: string;
  lyrics_original: string;
  lyrics_zh: string;
  lyrics_en: string;
  lyrics_source: string;
  lyrics_show_publicly: boolean;
};

function draftFromSong(s: AdminSong): DraftForm {
  return {
    yt_title:             s.yt_title            ?? '',
    title_original:       s.title_original      ?? '',
    title_zh:             s.title_zh            ?? '',
    title_en:             s.title_en            ?? '',
    artist_credit:        s.artist_credit       ?? '',
    url:                  s.url                 ?? '',
    language:             s.language            ?? '',
    ethnic_group:         s.ethnic_group        ?? '',
    region:               s.region              ?? '',
    location:             s.location            ?? '',
    genre:                s.genre               ?? '',
    recording_type:       s.recording_type      ?? '',
    year:                 s.year                ?? '',
    album:                s.album               ?? '',
    description:          s.description         ?? '',
    notes:                s.notes               ?? '',
    verification_status:  s.verification_status ?? 'candidate',
    tags:                 (s.tags ?? []).join(', '),
    lyrics_original:      s.lyrics_original     ?? '',
    lyrics_zh:            s.lyrics_zh           ?? '',
    lyrics_en:            s.lyrics_en           ?? '',
    lyrics_source:        '',
    lyrics_show_publicly: s.lyrics_show_publicly ?? false,
  };
}

function mergeEnriched(base: DraftForm, e: Record<string, string | null>): DraftForm {
  return {
    ...base,
    title_original:  e.title_original       ?? base.title_original,
    title_zh:        e.title_chinese         ?? base.title_zh,
    language:        e.language_claimed      ?? base.language,
    ethnic_group:    e.ethnic_group_claimed  ?? base.ethnic_group,
    genre:           e.genre                 ?? base.genre,
    recording_type:  e.recording_type        ?? base.recording_type,
    year:            e.year                  ?? base.year,
    album:           e.album_or_source       ?? base.album,
    notes:           e.notes                 ?? base.notes,
    lyrics_original: e.lyrics_original       ?? base.lyrics_original,
    lyrics_zh:       e.lyrics_translation_zh ?? base.lyrics_zh,
    lyrics_en:       e.lyrics_translation_en ?? base.lyrics_en,
    lyrics_source:   e.lyrics_source         ?? base.lyrics_source,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline = false, placeholder }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}>) {
  const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} className={cls} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />}
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

function MissingBadge({ label }: { label: string }) {
  const isUnapproved = label === 'lyrics_unapproved';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap leading-tight ${
      isUnapproved ? 'bg-blue-900/40 text-blue-400 border-blue-700/40' : 'bg-orange-900/40 text-orange-400 border-orange-700/40'
    }`}>
      {isUnapproved ? 'lyrics' : label}
    </span>
  );
}


// ── Main component ────────────────────────────────────────────────────────────

type AdminFilters = { language: string; verification_status: string; artist: string; missing_field: string };

export default function SongsAdminView({ filters }: Readonly<{
  filters: AdminFilters;
}>) {
  // List
  const [songs, setSongs]             = useState<AdminSong[]>([]);
  const [loading, setLoading]         = useState(false);
  const [listMessage, setListMessage] = useState('');
  const [query, setQuery]             = useState('');

  // Left rail
  const [railOpen, setRailOpen]       = useState(true);


  // Edit form (existing song selected)
  const [selected, setSelected]       = useState<AdminSong | null>(null);
  const [draft, setDraft]             = useState<DraftForm | null>(null);
  const [panelStatus, setPanelStatus] = useState<'idle' | 'researching' | 'saving' | 'saved' | 'error'>('idle');
  const [songResearched, setSongResearched] = useState(false);
  const [panelMessage, setPanelMessage]     = useState('');
  const [sources, setSources]         = useState<string[]>([]);

  // Section toggles — mutually exclusive
  const [activeSection, setActiveSection] = useState<'metadata' | 'lyrics' | null>('metadata');
  const showData   = activeSection === 'metadata';
  const showLyrics = activeSection === 'lyrics';
  const toggleSection = (s: 'metadata' | 'lyrics') =>
    setActiveSection(cur => cur === s ? null : s);

  // Batch
  const [batchRunning, setBatchRunning] = useState(false);
  const abortRef                        = useRef(false);
  const enrichAbortRef                  = useRef<AbortController | null>(null);

  const setField = (key: keyof DraftForm, value: string | boolean) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchSongs() {
    setLoading(true);
    setListMessage('');
    try {
      const res = await fetch('/api/admin/unaudited-songs?all=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSongs(Array.isArray(data) ? data : []);
    } catch (err) {
      setListMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchSongs(); }, []);

  // ── Selection ────────────────────────────────────────────────────────────────

  function deselect() {
    setSelected(null);
    setDraft(null);
    setPanelStatus('idle');
    setPanelMessage('');
    setSources([]);
    setSongResearched(false);
  }

  function handleSongClick(song: AdminSong) {
    if (selected?.id === song.id) {
      deselect();
    } else {
      setSelected(song);
      setDraft(draftFromSong(song));
      setPanelStatus('idle');
      setPanelMessage('');
      setSources([]);
      setSongResearched(false);
    }
  }

  // ── Research (single) ────────────────────────────────────────────────────────

  async function enrichSong(song: AdminSong) {
    enrichAbortRef.current?.abort();
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    setSongResearched(false);
    setPanelStatus('researching');
    setPanelMessage('');
    try {
      const videoId = getYouTubeId(song.yt_url) ?? '';
      const res = await fetch('/api/admin/enrich-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: song.yt_title ?? song.title, youtube_url: song.yt_url, videoId }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Research failed');
      if (json.sources?.length) setSources(json.sources as string[]);
      setDraft(mergeEnriched(draftFromSong(song), json.enriched as Record<string, string | null>));
      setSongResearched(true);
      setPanelStatus('idle');
      setPanelMessage('✓ Research complete — review and edit before saving.');
    } catch (err) {
      if (controller.signal.aborted) return;
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Research failed');
    }
  }

  function stopEnrich() {
    enrichAbortRef.current?.abort();
    enrichAbortRef.current = null;
    setPanelStatus('idle');
    setPanelMessage('');
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

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
      fetchSongs();
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }

  // ── Batch research ───────────────────────────────────────────────────────────

  async function handleBatchEnrich() {
    const targets = filteredSongs;
    abortRef.current = false;
    setBatchRunning(true);
    for (const song of targets) {
      if (abortRef.current) break;
      setListMessage(`Researching "${song.title}"…`);
      try {
        const videoId = getYouTubeId(song.yt_url) ?? '';
        const enrichRes = await fetch('/api/admin/enrich-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: song.yt_title ?? song.title, youtube_url: song.yt_url, videoId }),
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
    fetchSongs();
  }

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredSongs = songs.filter(s => {
    if (filters.language            && s.language            !== filters.language)            return false;
    if (filters.verification_status && s.verification_status !== filters.verification_status) return false;
    if (filters.artist              && s.artist_credit       !== filters.artist)              return false;
    if (filters.missing_field       && !s.missing.includes(filters.missing_field))           return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.title_original ?? s.yt_title ?? '').toLowerCase().includes(q)
      || (s.title_zh ?? '').toLowerCase().includes(q)
      || s.artist_credit.toLowerCase().includes(q);
  });

  const thumbId = selected?.yt_video_id ?? (selected?.yt_url ? getYouTubeId(selected.yt_url) : null);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#0f0f16] rounded-xl border border-white/10 overflow-hidden flex flex-col h-full min-h-[520px]">
      <div
        className="relative grid h-full"
        style={{ gridTemplateColumns: railOpen ? '450px 1fr' : '12px 1fr' }}
      >
        {/* Chevron handle — sits on the divider between left and right panels */}
        <button
          onClick={() => setRailOpen(o => !o)}
          style={{ left: railOpen ? '450px' : '12px' }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-4 h-9 flex items-center justify-center bg-stone-900 border border-white/10 rounded text-[11px] text-stone-500 hover:text-white hover:bg-stone-800 hover:border-white/25 transition-colors select-none"
          title={railOpen ? 'Collapse' : 'Expand'}
        >
          {railOpen ? '‹' : '›'}
        </button>

        {/* ── Left: song list ───────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-r border-white/5">

          {/* Collapsible content */}
          {railOpen && (
            <>
              {/* Search + Research All */}
              <div className="px-3 py-2.5 flex flex-col gap-2 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search songs…"
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  {batchRunning ? (
                    <button onClick={() => { abortRef.current = true; setBatchRunning(false); }}
                      className="shrink-0 text-[10px] px-2 py-1 rounded border bg-red-500/20 border-red-500/30 text-red-400 whitespace-nowrap">
                      ✕ Stop
                    </button>
                  ) : (
                    <button onClick={handleBatchEnrich} disabled={filteredSongs.length === 0}
                      className="shrink-0 text-[10px] px-2 py-1 rounded border bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40 whitespace-nowrap">
                      ✦ Research All ({filteredSongs.length})
                    </button>
                  )}
                </div>
                {listMessage && <p className="text-stone-500 text-[10px] italic truncate">{listMessage}</p>}
              </div>

              {/* Song list */}
              <div className={`flex-1 overflow-y-auto divide-y divide-white/5 ${SCROLLBAR}`}>
                {loading && <p className="text-stone-600 text-xs italic px-4 py-3">Loading…</p>}
                {!loading && filteredSongs.length === 0 && (
                  <p className="text-stone-600 text-xs italic px-4 py-3">
                    {query ? 'No songs match.' : 'No songs yet.'}
                  </p>
                )}
                {filteredSongs.map(song => (
                  <div
                    key={song.id}
                    className={`flex items-center gap-2.5 px-3 py-2 transition-colors border-l-2 ${
                      selected?.id === song.id
                        ? 'bg-white/8 border-violet-500'
                        : 'hover:bg-white/3 border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => handleSongClick(song)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                      {song.yt_video_id ? (
                        <img
                          src={`https://img.youtube.com/vi/${song.yt_video_id}/mqdefault.jpg`}
                          alt=""
                          className="shrink-0 w-12 h-8 object-cover rounded"
                        />
                      ) : (
                        <div className="shrink-0 w-12 h-8 rounded bg-white/5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate leading-tight ${song.title_original ? 'text-white' : 'text-stone-400 italic'}`}>
                          {song.title_original ?? song.yt_title ?? '(untitled)'}
                        </p>
                        <p className="text-stone-600 text-[10px] truncate">{song.artist_credit || '—'}</p>
                      </div>
                      {song.missing.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap justify-end shrink-0 max-w-24">
                          {song.missing.slice(0, 2).map(m => <MissingBadge key={m} label={m} />)}
                          {song.missing.length > 2 && <span className="text-[8px] text-stone-600 self-center">+{song.missing.length - 2}</span>}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => { handleSongClick(song); void enrichSong(song); }}
                      disabled={batchRunning}
                      title="Research with AI"
                      className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors disabled:opacity-40"
                    >
                      ✦
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: panel ─────────────────────────────────────────────────── */}
        <div className={`flex flex-col ${selected ? `overflow-y-auto ${SCROLLBAR}` : 'overflow-hidden'}`}>

          {/* ─ No song selected: add area ─ */}
          {!selected && (
            <div className="flex-1 min-h-0 p-6 flex flex-col">
              <AddMultipleSongsPanel />
            </div>
          )}

          {/* ─ Song selected: edit form ─ */}
          {selected && (
            <div className="p-5 flex flex-col gap-4">

              {/* Header card + toggle buttons + Research (same row, same height) */}
              <div className="flex items-stretch gap-2">

                {/* Header card */}
                <div className="flex-1 flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/10 min-w-0">
                  {thumbId && (
                    <img
                      src={`https://img.youtube.com/vi/${thumbId}/mqdefault.jpg`}
                      alt=""
                      className="w-[90px] h-[50px] object-cover rounded shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-white text-base font-bold leading-tight">
                        {selected.title_original ?? selected.yt_title ?? '(untitled)'}
                      </p>
                      {selected.missing.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          {selected.missing.map(m => <MissingBadge key={m} label={m} />)}
                        </div>
                      )}
                    </div>
                    <p className="text-stone-400 text-sm mt-0.5 leading-tight">{selected.artist_credit || '—'}</p>
                    {selected.yt_url && (
                      <a href={selected.yt_url} target="_blank" rel="noopener noreferrer"
                        className="text-sky-400 text-[10px] hover:underline mt-1 block truncate">
                        {selected.yt_url}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={deselect}
                    className="text-stone-500 hover:text-white transition-colors text-xs leading-none shrink-0"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>

                {/* Metadata + Lyrics toggles — stacked, mutually exclusive */}
                <div className="flex flex-col gap-2 shrink-0 w-20">
                  <button
                    onClick={() => toggleSection('metadata')}
                    className={`flex-1 flex items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors ${
                      showData
                        ? 'bg-stone-500/30 border-stone-400/30 text-stone-200'
                        : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                    }`}
                  >
                    Metadata
                  </button>
                  <button
                    onClick={() => toggleSection('lyrics')}
                    className={`flex-1 flex items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors ${
                      showLyrics
                        ? 'bg-stone-500/30 border-stone-400/30 text-stone-200'
                        : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                    }`}
                  >
                    Lyrics
                  </button>
                </div>

                {/* Research button */}
                <div className="shrink-0 flex w-20">
                  {panelStatus === 'researching' ? (
                    <button onClick={stopEnrich}
                      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[10px] font-semibold transition-colors">
                      <span>✕</span>
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button onClick={() => void enrichSong(selected)} disabled={batchRunning || songResearched}
                      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                      <span className="text-sm">✦</span>
                      <span className="leading-tight text-center whitespace-pre-line">
                        {songResearched ? '✓ Done' : 'Research\nwith AI'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Save button */}
                <div className="shrink-0 flex w-20">
                  <button
                    onClick={() => void saveSelected()}
                    disabled={panelStatus === 'saving' || panelStatus === 'researching'}
                    className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition-colors disabled:opacity-40"
                  >
                    <span className="text-sm">{panelStatus === 'saving' ? '…' : '✓'}</span>
                    <span className="leading-tight text-center whitespace-pre-line">
                      {panelStatus === 'saving' ? 'Saving' : 'Save\nChanges'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
              )}

              {/* Panel message */}
              {panelMessage && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  panelStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : panelStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  {panelMessage}
                </div>
              )}

              {/* ── Data & Metadata section ─────────────────────────────────── */}
              {showData && draft && (
                  <div className="flex flex-col gap-4">
                    {/* 2-column grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 items-start">

                      {/* Left column */}
                      <div className="flex flex-col gap-4">
                        <Field label="YouTube title"      value={draft.yt_title}        onChange={v => setField('yt_title', v)} placeholder="YouTube video title" />
                        <Field label="Title (original)"  value={draft.title_original} onChange={v => setField('title_original', v)} />
                        <Field label="Title (Chinese)"   value={draft.title_zh}        onChange={v => setField('title_zh', v)} />
                        <Field label="Title (English)"   value={draft.title_en}        onChange={v => setField('title_en', v)} />
                        <Field label="Artist credit"     value={draft.artist_credit}   onChange={v => setField('artist_credit', v)} />
                        <Field label="Year"              value={draft.year}            onChange={v => setField('year', v)} placeholder="e.g. 2019" />
                        <Field label="Album / Source"    value={draft.album}           onChange={v => setField('album', v)} />
                        <SelectField label="Language"    value={draft.language}        onChange={v => setField('language', v)} options={LANGUAGES} />
                      </div>

                      {/* Right column */}
                      <div className="flex flex-col gap-4">
                        <SelectField label="Status"       value={draft.verification_status} onChange={v => setField('verification_status', v)} options={VERIFICATION_STATUSES} />
                        <SelectField label="Ethnic group" value={draft.ethnic_group}         onChange={v => setField('ethnic_group', v)}         options={LANGUAGES} />
                        <SelectField label="Genre"        value={draft.genre}                onChange={v => setField('genre', v)}                options={GENRES} />
                        <SelectField label="Performance"  value={draft.recording_type}       onChange={v => setField('recording_type', v)}       options={RECORDING_TYPES} />
                        <Field label="Location"           value={draft.location}             onChange={v => setField('location', v)} placeholder="Village or locality" />
                        <Field label="Region"             value={draft.region}               onChange={v => setField('region', v)} placeholder="e.g. Eastern Taiwan" />
                        <Field label="Non-YouTube URL"    value={draft.url}                  onChange={v => setField('url', v)} placeholder="Bandcamp, SoundCloud, etc." />
                        <Field label="Tags (comma-separated)" value={draft.tags}             onChange={v => setField('tags', v)} placeholder="e.g. love-song, traditional" />
                      </div>
                    </div>

                    {/* Full-width fields below the grid */}
                    <Field label="Description (public)" value={draft.description} onChange={v => setField('description', v)} multiline
                      placeholder="Public-facing context shown to visitors" />
                    <Field label="Notes" value={draft.notes} onChange={v => setField('notes', v)} multiline />
                  </div>
                )}

              {/* ── Lyrics section ──────────────────────────────────────────── */}
              {showLyrics && draft && (
                <div className="flex flex-col gap-3">
                  {/* Source + approval inline at top */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Field label="Lyrics source" value={draft.lyrics_source} onChange={v => setField('lyrics_source', v)} placeholder="URL or description" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setField('lyrics_show_publicly', !draft.lyrics_show_publicly)}
                      className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        draft.lyrics_show_publicly
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                      }`}
                    >
                      <div className={`relative w-7 h-3.5 rounded-full transition-colors shrink-0 ${draft.lyrics_show_publicly ? 'bg-emerald-500' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform duration-200 ${draft.lyrics_show_publicly ? 'translate-x-3.5' : ''}`} />
                      </div>
                      <span>Public</span>
                    </button>
                  </div>
                  {/* 3 lyrics fields side by side */}
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Original"           value={draft.lyrics_original} onChange={v => setField('lyrics_original', v)} multiline />
                    <Field label="Chinese"             value={draft.lyrics_zh}       onChange={v => setField('lyrics_zh', v)}       multiline />
                    <Field label="English"             value={draft.lyrics_en}       onChange={v => setField('lyrics_en', v)}       multiline />
                  </div>
                </div>
              )}


            </div>
          )}
        </div>
      </div>
    </div>
  );
}
