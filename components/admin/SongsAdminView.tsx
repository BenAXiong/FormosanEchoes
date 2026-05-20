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
  artist_display: string | null;
  linked_artists: { id: string; name_display: string }[];
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
  lyrics_source: string | null;
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
  const rawUrl = s.url ?? '';
  const isYtUrl = rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be');
  return {
    yt_title:             s.yt_title            ?? '',
    title_original:       s.title_original      ?? '',
    title_zh:             s.title_zh            ?? '',
    title_en:             s.title_en            ?? '',
    artist_credit:        s.artist_credit       ?? '',
    url:                  isYtUrl ? '' : rawUrl,
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
    lyrics_source:        s.lyrics_source        ?? '',
    lyrics_show_publicly: s.lyrics_show_publicly ?? false,
  };
}

function hasChinese(v: string | null | undefined): boolean {
  return !!v && /[一-鿿㐀-䶿]/.test(v);
}

function mergeEnriched(base: DraftForm, e: Record<string, string | null>): DraftForm {
  return {
    ...base,
    // Don't put Chinese-only text into title_original — indigenous titles are Latin-script or indigenous-script
    title_original:  (e.title_original && !hasChinese(e.title_original)) ? e.title_original : base.title_original,
    title_zh:        e.title_chinese         ?? base.title_zh,
    language:        e.language_claimed      ?? base.language,
    ethnic_group:    e.ethnic_group_claimed  ?? base.ethnic_group,
    genre:           e.genre                 ?? base.genre,
    recording_type:  e.recording_type        ?? base.recording_type,
    year:            e.year                  ?? base.year,
    album:           base.album,
    notes:           e.notes                 ?? base.notes,
    lyrics_original: e.lyrics_original       ?? base.lyrics_original,
    lyrics_zh:       e.lyrics_translation_zh ?? base.lyrics_zh,
    lyrics_en:       e.lyrics_translation_en ?? base.lyrics_en,
    lyrics_source:   e.lyrics_source         ?? base.lyrics_source,
    tags:            e.tags                  ?? base.tags,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline = false, placeholder, fill = false }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; fill?: boolean;
}>) {
  const cls = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none ${fill ? 'flex-1 min-h-0' : ''} ${SCROLLBAR}`;
  return (
    <div className={`flex flex-col gap-1 ${fill ? 'h-full' : ''}`}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 shrink-0">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={fill ? undefined : 4} className={cls} />
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
        <option value="" className="bg-stone-900 text-white">— select —</option>
        {options.map(o => <option key={o} value={o} className="bg-stone-900 text-white">{o}</option>)}
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


const inputCls = `w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors ${SCROLLBAR}`;

function BField({ label, value, onChange, multiline }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputCls} />}
    </div>
  );
}

function BSelect({ label, value, onChange, options }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; options: string[];
}>) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 transition-colors">
        <option value="" className="bg-stone-900 text-white">— select —</option>
        {options.map(o => <option key={o} value={o} className="bg-stone-900 text-white">{o}</option>)}
      </select>
    </div>
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
  const [sources, setSources]               = useState<{ url: string; title: string | null }[]>([]);

  // Artist link picker
  const [linkPickerOpen, setLinkPickerOpen]       = useState(false);
  const [linkQuery, setLinkQuery]                 = useState('');
  const [allArtists, setAllArtists]               = useState<{ id: string; name_display: string }[] | null>(null);
  const [loadingArtists, setLoadingArtists]       = useState(false);

  // Section toggles — mutually exclusive
  const [activeSection, setActiveSection] = useState<'metadata' | 'lyrics' | null>('metadata');
  const showData   = activeSection === 'metadata';
  const showLyrics = activeSection === 'lyrics';
  const toggleSection = (s: 'metadata' | 'lyrics') =>
    setActiveSection(cur => cur === s ? null : s);

  // Batch
  const [batchRunning, setBatchRunning]   = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; elapsed: number; title: string } | null>(null);
  const abortRef                          = useRef(false);
  const enrichAbortRef                    = useRef<AbortController | null>(null);
  const elapsedRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  type BatchEntry = {
    draft: DraftForm;
    section: 'metadata' | 'lyrics' | null;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    researched: boolean;
  };
  const [batchEntries, setBatchEntries] = useState<Map<string, BatchEntry>>(new Map());
  const checkedIds = new Set(batchEntries.keys());

  function toggleCheck(song: AdminSong) {
    setBatchEntries(prev => {
      const m = new Map(prev);
      if (m.has(song.id)) { m.delete(song.id); }
      else { m.set(song.id, { draft: draftFromSong(song), section: null, saveStatus: 'idle', researched: false }); }
      return m;
    });
  }

  function patchBatchEntry(id: string, patch: Partial<BatchEntry>) {
    setBatchEntries(prev => {
      const m = new Map(prev);
      const e = m.get(id);
      if (e) m.set(id, { ...e, ...patch });
      return m;
    });
  }

  function updateBatchDraft(songId: string, key: keyof DraftForm, value: string | boolean) {
    setBatchEntries(prev => {
      const m = new Map(prev);
      const e = m.get(songId);
      if (e) m.set(songId, { ...e, draft: { ...e.draft, [key]: value } });
      return m;
    });
  }

  const setField = (key: keyof DraftForm, value: string | boolean) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchSongs(): Promise<AdminSong[]> {
    setLoading(true);
    setListMessage('');
    try {
      const res = await fetch('/api/admin/unaudited-songs?all=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const list = Array.isArray(data) ? (data as AdminSong[]) : [];
      setSongs(list);
      return list;
    } catch (err) {
      setListMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return [];
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
    setLinkPickerOpen(false);
    setLinkQuery('');
  }

  function handleSongClick(song: AdminSong) {
    if (selected?.id === song.id) {
      deselect();
    } else {
      setSelected(song);
      const batchEntry = batchEntries.get(song.id);
      if (batchEntry?.researched) {
        setDraft(batchEntry.draft);
        setPanelMessage('✓ Research loaded — review and save.');
        setSongResearched(true);
      } else {
        setDraft(draftFromSong(song));
        setPanelMessage('');
        setSongResearched(false);
      }
      setPanelStatus('idle');
      setSources([]);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function deleteSong(song: AdminSong) {
    if (!window.confirm(`Delete "${song.title_original ?? song.yt_title ?? 'this song'}"? This cannot be undone.`)) return;
    const res = await fetch('/api/admin/delete-song', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: song.id }),
    });
    if (res.ok) {
      setSongs(prev => prev.filter(s => s.id !== song.id));
      if (selected?.id === song.id) setSelected(null);
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
      const currentDraft = draft ?? draftFromSong(song);
      const res = await fetch('/api/admin/enrich-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentDraft.title_original || currentDraft.title_zh || (song.yt_title ?? song.title),
          youtube_url: song.yt_url,
          videoId,
          artist_credit: currentDraft.artist_credit || song.artist_credit,
        }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Research failed');
      const srcs = (json.sources ?? []) as { url: string; title: string | null }[];
      if (srcs.length) setSources(srcs);
      const merged = mergeEnriched(currentDraft, json.enriched as Record<string, string | null>);
      const hasLyricsContent = !!(merged.lyrics_original || merged.lyrics_zh || merged.lyrics_en);
      if (!hasLyricsContent) {
        merged.lyrics_source = `[not found — AI ${new Date().toISOString().slice(0, 10)}]`;
      } else if (merged.lyrics_source?.startsWith('AI research') && srcs.length) {
        // Gemini found lyrics but didn't name the source — use the first grounding title
        merged.lyrics_source = srcs[0].title ?? srcs[0].url;
      }
      setDraft(merged);
      setSongResearched(true);
      setPanelStatus('idle');
      setPanelMessage('');

      // Auto-link artist if a DB match was found
      const match = json.artist_match as { id: string; name_display: string } | null;
      if (match && !song.linked_artists.some(a => a.id === match.id)) {
        const linkRes = await fetch('/api/admin/link-song-artist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: song.id, artist_id: match.id }),
        });
        if (linkRes.ok) {
          const linkJson = await linkRes.json();
          const linked = linkJson.linked as { id: string; name_display: string }[];
          setSongs(prev => prev.map(s => s.id === song.id
            ? { ...s, linked_artists: linked, artist_display: linked.map(a => a.name_display).join(' × ') }
            : s
          ));
          if (selected?.id === song.id) setSelected(prev => prev ? { ...prev, linked_artists: linked, artist_display: linked.map(a => a.name_display).join(' × ') } : prev);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Research failed');
    }
  }

  async function unlinkArtist(song: AdminSong, artistId: string) {
    const res = await fetch('/api/admin/link-song-artist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: song.id, artist_id: artistId }),
    });
    if (res.ok) {
      const json = await res.json();
      const linked = json.linked as { id: string; name_display: string }[];
      const display = linked.length > 0 ? linked.map(a => a.name_display).join(' × ') : null;
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, linked_artists: linked, artist_display: display } : s));
      if (selected?.id === song.id) setSelected(prev => prev ? { ...prev, linked_artists: linked, artist_display: display } : prev);
    }
  }

  async function openLinkPicker() {
    setLinkPickerOpen(true);
    setLinkQuery('');
    if (allArtists === null && !loadingArtists) {
      setLoadingArtists(true);
      try {
        const res = await fetch('/api/admin/all-artists');
        const data = await res.json() as { id: string; name_display: string }[];
        setAllArtists(data.map(a => ({ id: a.id, name_display: a.name_display })));
      } finally {
        setLoadingArtists(false);
      }
    }
  }

  async function linkArtist(song: AdminSong, artistId: string) {
    const res = await fetch('/api/admin/link-song-artist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: song.id, artist_id: artistId }),
    });
    if (res.ok) {
      const json = await res.json();
      const linked = json.linked as { id: string; name_display: string }[];
      const display = linked.length > 0 ? linked.map(a => a.name_display).join(' × ') : null;
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, linked_artists: linked, artist_display: display } : s));
      if (selected?.id === song.id) setSelected(prev => prev ? { ...prev, linked_artists: linked, artist_display: display } : prev);
      setLinkPickerOpen(false);
      setLinkQuery('');
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
    const savedId = selected.id;
    setPanelStatus('saving');
    setPanelMessage('');
    try {
      const res = await fetch('/api/admin/update-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: savedId, fields: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setPanelStatus('saved');
      setSongResearched(false);
      const refreshed = await fetchSongs();
      const updatedSong = refreshed.find(s => s.id === savedId);
      if (updatedSong) {
        setSelected(updatedSong);
        setDraft(draftFromSong(updatedSong));
      }
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }

  // ── Batch research ───────────────────────────────────────────────────────────

  function stopBatch() {
    abortRef.current = true;
    setBatchRunning(false);
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
  }

  // Auto-save batch — used by "Research All"
  async function handleBatchEnrich() {
    if (filteredSongs.length > 10 && !window.confirm(
      `Research all ${filteredSongs.length} songs? This will make ${filteredSongs.length} AI calls and may take several minutes.`
    )) return;
    abortRef.current = false;
    setBatchRunning(true);
    const snapshot = [...filteredSongs]; // freeze list at start

    for (let i = 0; i < snapshot.length; i++) {
      const song = snapshot[i];
      if (abortRef.current) break;

      // Progress + elapsed timer
      const startTime = Date.now();
      setBatchProgress({ current: i + 1, total: snapshot.length, elapsed: 0, title: song.title_original ?? song.yt_title ?? song.title });
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setBatchProgress(p => p ? { ...p, elapsed: Math.floor((Date.now() - startTime) / 1000) } : null);
      }, 1000);

      try {
        const videoId = getYouTubeId(song.yt_url) ?? '';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90_000);
        let enrichJson: Record<string, unknown> | null = null;
        try {
          const enrichRes = await fetch('/api/admin/enrich-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: song.yt_title ?? song.title, youtube_url: song.yt_url, videoId, artist_credit: song.artist_credit }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const json = await enrichRes.json();
          if (enrichRes.ok) enrichJson = json;
        } catch { clearTimeout(timeoutId); /* timeout or network — skip */ }

        if (enrichJson?.enriched) {
          const saveRes = await fetch('/api/admin/update-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: song.id, enriched: enrichJson.enriched }),
          });
          if (saveRes.ok) setSongs(prev => prev.filter(s => s.id !== song.id));
        }
      } catch { /* skip */ }

      await new Promise(r => setTimeout(r, 400));
    }

    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
    setListMessage('');
    setBatchRunning(false);
    fetchSongs();
  }

  // Review-mode batch — researches selected songs, merges results into their BatchEntry drafts
  async function handleBatchEnrichSelected(targets: typeof filteredSongs) {
    abortRef.current = false;
    setBatchRunning(true);

    for (let i = 0; i < targets.length; i++) {
      const song = targets[i];
      if (abortRef.current) break;

      const startTime = Date.now();
      setBatchProgress({ current: i + 1, total: targets.length, elapsed: 0, title: song.title_original ?? song.yt_title ?? song.title });
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setBatchProgress(p => p ? { ...p, elapsed: Math.floor((Date.now() - startTime) / 1000) } : null);
      }, 1000);

      try {
        const videoId = getYouTubeId(song.yt_url) ?? '';
        const entryDraft = batchEntries.get(song.id)?.draft;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90_000);
        let enrichRes: Response | null = null;
        let enrichJson: Record<string, unknown> = {};
        try {
          enrichRes = await fetch('/api/admin/enrich-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: entryDraft?.title_original || entryDraft?.title_zh || (song.yt_title ?? song.title),
              youtube_url: song.yt_url,
              videoId,
              artist_credit: entryDraft?.artist_credit || song.artist_credit,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          enrichJson = await enrichRes.json();
        } catch { clearTimeout(timeoutId); }

        if (enrichRes?.ok && enrichJson.enriched) {
          setBatchEntries(prev => {
            const m = new Map(prev);
            const e = m.get(song.id);
            if (!e) return prev;
            const merged = mergeEnriched(e.draft, enrichJson.enriched as Record<string, string | null>);
            if (!merged.lyrics_original && !merged.lyrics_zh && !merged.lyrics_en) {
              merged.lyrics_source = `[not found — AI ${new Date().toISOString().slice(0, 10)}]`;
            }
            m.set(song.id, { ...e, draft: merged, researched: true, section: 'metadata' });
            return m;
          });
        }
      } catch { /* skip */ }

      await new Promise(r => setTimeout(r, 400));
    }

    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
    setListMessage(`✓ ${targets.length} songs researched — review and save in the panel.`);
    setBatchRunning(false);
  }

  async function saveBatchSong(song: AdminSong) {
    const entry = batchEntries.get(song.id);
    if (!entry) return;
    patchBatchEntry(song.id, { saveStatus: 'saving' });
    try {
      const res = await fetch('/api/admin/update-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id, fields: entry.draft }),
      });
      if (!res.ok) throw new Error('Save failed');
      patchBatchEntry(song.id, { saveStatus: 'saved' });
      setTimeout(() => {
        setBatchEntries(prev => { const m = new Map(prev); m.delete(song.id); return m; });
      }, 800);
    } catch {
      patchBatchEntry(song.id, { saveStatus: 'error' });
    }
  }

  async function saveAllResearched() {
    const targets = checkedSongs.filter(s => batchEntries.get(s.id)?.researched && batchEntries.get(s.id)?.saveStatus === 'idle');
    for (const song of targets) {
      await saveBatchSong(song);
      await new Promise(r => setTimeout(r, 300));
    }
    fetchSongs();
  }

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredSongs = songs.filter(s => {
    if (filters.language            && s.language            !== filters.language)            return false;
    if (filters.verification_status && s.verification_status !== filters.verification_status) return false;
    if (filters.artist              && s.artist_credit       !== filters.artist)              return false;
    if (filters.missing_field === 'any'      && s.missing.length === 0)                                          return false;
    if (filters.missing_field === 'any_core' && s.missing.filter(m => m !== 'lyrics_unapproved').length === 0)  return false;
    if (filters.missing_field && filters.missing_field !== 'any' && filters.missing_field !== 'any_core' && !s.missing.includes(filters.missing_field)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (s.title_original ?? s.yt_title ?? '').toLowerCase().includes(q)
      || (s.title_zh ?? '').toLowerCase().includes(q)
      || s.artist_credit.toLowerCase().includes(q);
  });

  const allVisibleChecked = filteredSongs.length > 0 && filteredSongs.every(s => batchEntries.has(s.id));
  const toggleCheckAll = () => {
    if (allVisibleChecked) {
      setBatchEntries(prev => { const m = new Map(prev); filteredSongs.forEach(s => m.delete(s.id)); return m; });
    } else {
      setBatchEntries(prev => {
        const m = new Map(prev);
        filteredSongs.forEach(s => { if (!m.has(s.id)) m.set(s.id, { draft: draftFromSong(s), section: null, saveStatus: 'idle', researched: false }); });
        return m;
      });
    }
  };

  const thumbId = selected?.yt_video_id ?? (selected?.yt_url ? getYouTubeId(selected.yt_url) : null);

  const checkedSongs = filteredSongs.filter(s => batchEntries.has(s.id));
  const researchedCount = checkedSongs.filter(s => batchEntries.get(s.id)?.researched).length;

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
              {/* Search + Research */}
              <div className="px-3 py-2.5 flex flex-col gap-2 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={toggleCheckAll}
                    title="Select all visible"
                    className="shrink-0 accent-violet-500 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search songs…"
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  {batchRunning ? (
                    <button onClick={stopBatch}
                      className="shrink-0 text-[10px] px-2 py-1 rounded border bg-red-500/20 border-red-500/30 text-red-400 whitespace-nowrap">
                      ✕ Stop
                    </button>
                  ) : checkedIds.size > 0 ? (
                    <button onClick={() => handleBatchEnrichSelected(filteredSongs.filter(s => checkedIds.has(s.id)))}
                      className="shrink-0 text-[10px] px-2 py-1 rounded border bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors whitespace-nowrap">
                      ✦ Research {checkedIds.size}
                    </button>
                  ) : (
                    <button onClick={() => handleBatchEnrich()} disabled={filteredSongs.length === 0}
                      className="shrink-0 text-[10px] px-2 py-1 rounded border bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40 whitespace-nowrap">
                      ✦ All ({filteredSongs.length})
                    </button>
                  )}
                </div>
                {batchRunning && batchProgress ? (
                  <div className="flex flex-col gap-1">
                    <div className="w-full h-0.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 transition-all duration-500 rounded-full"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">
                      <span className="text-stone-300 font-mono tabular-nums">{batchProgress.current}/{batchProgress.total}</span>
                      {' · '}<span className="truncate">{batchProgress.title}</span>
                      {' · '}<span className={batchProgress.elapsed >= 70 ? 'text-amber-400' : ''}>{batchProgress.elapsed}s{batchProgress.elapsed >= 70 ? ' ⚠' : ''}</span>
                    </p>
                  </div>
                ) : listMessage ? (
                  <p className="text-stone-500 text-[10px] italic truncate">{listMessage}</p>
                ) : null}
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
                    <input
                      type="checkbox"
                      checked={checkedIds.has(song.id)}
                      onChange={() => toggleCheck(song)}
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 accent-violet-500 cursor-pointer"
                    />
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
                        <p className="text-stone-600 text-[10px] truncate">{song.artist_display || song.artist_credit || '—'}</p>
                      </div>
                      {song.missing.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap justify-end shrink-0 max-w-24">
                          {song.missing.slice(0, 2).map(m => <MissingBadge key={m} label={m} />)}
                          {song.missing.length > 2 && <span className="text-[8px] text-stone-600 self-center">+{song.missing.length - 2}</span>}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => { if (selected?.id !== song.id) handleSongClick(song); void enrichSong(song); }}
                      disabled={batchRunning}
                      title="Research with AI"
                      className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors disabled:opacity-40"
                    >
                      ✦
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); void deleteSong(song); }}
                      title="Delete song"
                      className="shrink-0 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/25 text-red-500/60 hover:text-red-400 text-[10px] transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: panel ─────────────────────────────────────────────────── */}
        <div className={`flex flex-col h-full ${selected && showLyrics ? 'overflow-hidden' : selected ? `overflow-y-auto ${SCROLLBAR}` : 'overflow-hidden'}`}>

          {/* ─ No song selected, no checkboxes: add area ─ */}
          {!selected && batchEntries.size === 0 && (
            <div className="flex-1 min-h-0 p-6 flex flex-col">
              <AddMultipleSongsPanel />
            </div>
          )}

          {/* ─ No song selected, checkboxes active: batch review ─ */}
          {!selected && batchEntries.size > 0 && (
            <div className="flex flex-col h-full overflow-hidden">

              {/* Header */}
              <div className="px-5 py-3 border-b border-white/10 flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-white">{checkedSongs.length} selected</span>
                {researchedCount > 0 && <span className="text-[10px] text-violet-400 font-medium">✦ {researchedCount} researched</span>}
                <div className="ml-auto flex gap-2">
                  {researchedCount > 0 && !batchRunning && (
                    <button onClick={() => void saveAllResearched()}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                      Save all researched ({researchedCount})
                    </button>
                  )}
                  <button onClick={() => setBatchEntries(new Map())}
                    className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-stone-400 hover:text-white transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {/* Queue */}
              <div className={`flex-1 overflow-y-auto flex flex-col gap-1.5 p-3 ${SCROLLBAR}`}>
                {checkedSongs.map(song => {
                  const entry = batchEntries.get(song.id);
                  if (!entry) return null;
                  const d = entry.draft;
                  const saveCls =
                    entry.saveStatus === 'saved'  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                    entry.saveStatus === 'error'  ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                    entry.saveStatus === 'saving' ? 'bg-white/5 border-white/10 text-stone-500' :
                    entry.researched              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30' :
                                                   'bg-white/5 border-white/10 text-stone-400 hover:text-white hover:border-white/25';
                  return (
                    <div key={song.id} className="shrink-0 rounded-lg bg-white/5 border border-white/5 overflow-hidden">

                      {/* Row header */}
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
                        onClick={() => patchBatchEntry(song.id, { section: entry.section !== null ? null : 'metadata' })}
                      >
                        <div className="shrink-0 w-12 h-[27px] rounded overflow-hidden bg-stone-800">
                          {song.yt_video_id
                            ? <img src={`https://img.youtube.com/vi/${song.yt_video_id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-stone-600 text-[10px]">—</div>}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate leading-tight">
                            {song.title_original ?? song.yt_title ?? '(untitled)'}
                          </p>
                          <p className="text-[10px] text-stone-500 truncate">{song.artist_display || song.artist_credit || '—'}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          {entry.researched && <span className="text-violet-400 text-[10px]">✦</span>}

                          {/* Metadata / Lyrics toggle */}
                          <div className="flex gap-0.5 bg-white/5 border border-white/10 rounded p-0.5">
                            {(['metadata', 'lyrics'] as const).map(sec => (
                              <button key={sec}
                                onClick={() => patchBatchEntry(song.id, { section: entry.section === sec ? null : sec })}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                                  entry.section === sec ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-stone-300'
                                }`}>
                                {sec.charAt(0).toUpperCase() + sec.slice(1)}
                              </button>
                            ))}
                          </div>

                          <button onClick={() => void saveBatchSong(song)}
                            disabled={entry.saveStatus === 'saving' || entry.saveStatus === 'saved'}
                            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${saveCls}`}>
                            {entry.saveStatus === 'saved' ? '✓' : entry.saveStatus === 'saving' ? '…' : entry.saveStatus === 'error' ? '! Err' : 'Save'}
                          </button>

                          <button onClick={() => toggleCheck(song)}
                            className="text-stone-600 hover:text-stone-300 transition-colors text-xs" title="Remove">
                            ✕
                          </button>
                        </div>

                        <span className={`shrink-0 text-stone-500 text-xs select-none inline-block transition-transform duration-150 ${entry.section !== null ? 'rotate-90' : ''}`}>›</span>
                      </div>

                      {/* Inline form */}
                      {entry.section !== null && (
                        <div className="px-4 pb-4 pt-1 border-t border-white/5">

                          {entry.section === 'metadata' && (
                            <div className="flex flex-col gap-3 mt-3">
                              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                <div className="flex flex-col gap-3">
                                  <BField label="Title (original)" value={d.title_original} onChange={v => updateBatchDraft(song.id, 'title_original', v)} />
                                  <BField label="Title (Chinese)"  value={d.title_zh}       onChange={v => updateBatchDraft(song.id, 'title_zh', v)} />
                                  <BField label="Title (English)"  value={d.title_en}        onChange={v => updateBatchDraft(song.id, 'title_en', v)} />
                                  <BField label="Artist credit"    value={d.artist_credit}   onChange={v => updateBatchDraft(song.id, 'artist_credit', v)} />
                                  <BField label="Year"             value={d.year}            onChange={v => updateBatchDraft(song.id, 'year', v)} />
                                  <BField label="Album"            value={d.album}           onChange={v => updateBatchDraft(song.id, 'album', v)} />
                                  <BSelect label="Language" value={d.language} onChange={v => updateBatchDraft(song.id, 'language', v)} options={LANGUAGES} />
                                </div>
                                <div className="flex flex-col gap-3">
                                  <BSelect label="Status"       value={d.verification_status} onChange={v => updateBatchDraft(song.id, 'verification_status', v)} options={VERIFICATION_STATUSES} />
                                  <BSelect label="Ethnic group" value={d.ethnic_group}        onChange={v => updateBatchDraft(song.id, 'ethnic_group', v)}        options={LANGUAGES} />
                                  <BSelect label="Genre"        value={d.genre}               onChange={v => updateBatchDraft(song.id, 'genre', v)}               options={GENRES} />
                                  <BSelect label="Performance"  value={d.recording_type}      onChange={v => updateBatchDraft(song.id, 'recording_type', v)}      options={RECORDING_TYPES} />
                                  <BField label="Location"      value={d.location}            onChange={v => updateBatchDraft(song.id, 'location', v)} />
                                  <BField label="Region"        value={d.region}              onChange={v => updateBatchDraft(song.id, 'region', v)} />
                                </div>
                              </div>
                              <BField label="Notes" value={d.notes} onChange={v => updateBatchDraft(song.id, 'notes', v)} multiline />
                            </div>
                          )}

                          {entry.section === 'lyrics' && (
                            <div className="flex flex-col gap-3 mt-3">
                              <div className="flex items-end gap-3">
                                <div className="flex-1">
                                  <BField label="Lyrics source" value={d.lyrics_source} onChange={v => updateBatchDraft(song.id, 'lyrics_source', v)} />
                                </div>
                                <button type="button"
                                  onClick={() => updateBatchDraft(song.id, 'lyrics_show_publicly', !d.lyrics_show_publicly)}
                                  className={`shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-semibold transition-colors ${
                                    d.lyrics_show_publicly
                                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                      : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                                  }`}>
                                  <div className={`relative w-5 h-2.5 rounded-full transition-colors shrink-0 ${d.lyrics_show_publicly ? 'bg-emerald-500' : 'bg-white/15'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-white shadow transition-transform duration-200 ${d.lyrics_show_publicly ? 'translate-x-2.5' : ''}`} />
                                  </div>
                                  Public
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <BField label="Original" value={d.lyrics_original} onChange={v => updateBatchDraft(song.id, 'lyrics_original', v)} multiline />
                                <BField label="Chinese"  value={d.lyrics_zh}       onChange={v => updateBatchDraft(song.id, 'lyrics_zh', v)}       multiline />
                                <BField label="English"  value={d.lyrics_en}       onChange={v => updateBatchDraft(song.id, 'lyrics_en', v)}       multiline />
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─ Song selected: edit form ─ */}
          {selected && (
            <div className={`p-5 flex flex-col gap-4 ${showLyrics ? 'flex-1 min-h-0 overflow-hidden' : ''}`}>

              {/* Header card + toggle buttons + Research (same row, same height) */}
              <div className="flex items-stretch gap-2">

                {/* Header card */}
                <div className="flex-1 flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 border border-white/10 min-w-0">
                  <button
                    onClick={deselect}
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white/10 hover:bg-white/20 text-stone-400 hover:text-white transition-colors text-[10px] leading-none"
                    title="Close"
                  >
                    ✕
                  </button>
                  {thumbId && (
                    <img
                      src={`https://img.youtube.com/vi/${thumbId}/mqdefault.jpg`}
                      alt=""
                      className="w-16 h-9 object-cover rounded shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    {/* Title row */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {selected.yt_url && (
                        <a href={selected.yt_url} target="_blank" rel="noopener noreferrer" title="Open on YouTube"
                          className="shrink-0 text-stone-500 hover:text-red-400 transition-colors">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.75 15.5v-7l6.25 3.5-6.25 3.5z"/>
                          </svg>
                        </a>
                      )}
                      <p className="text-white text-sm font-bold truncate leading-tight flex-1 min-w-0">
                        {selected.title_original ?? selected.yt_title ?? '(untitled)'}
                      </p>
                      {selected.missing.length > 0 && (
                        <div className="flex gap-0.5 items-center shrink-0">
                          {selected.missing.slice(0, 1).map(m => <MissingBadge key={m} label={m} />)}
                          {selected.missing.length > 1 && <span className="text-[9px] text-stone-600">+{selected.missing.length - 1}</span>}
                        </div>
                      )}
                    </div>
                    {/* Artist row */}
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(selected.artist_credit)}`}
                        target="_blank" rel="noopener noreferrer" title="Search artist"
                        className="shrink-0 text-stone-500 hover:text-stone-300 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                      <p className="text-stone-400 text-xs truncate leading-tight flex-1 min-w-0">
                        {selected.artist_credit || '—'}
                      </p>
                      {selected.linked_artists.map(a => (
                        <span key={a.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium shrink-0">
                          🔗 {a.name_display}
                          <button onClick={() => void unlinkArtist(selected, a.id)} title="Unlink" className="hover:text-red-400 transition-colors leading-none">✕</button>
                        </span>
                      ))}
                      {/* Manual link picker */}
                      {linkPickerOpen ? (
                        <div className="relative shrink-0">
                          <input
                            autoFocus
                            type="text"
                            value={linkQuery}
                            onChange={e => setLinkQuery(e.target.value)}
                            onBlur={() => setTimeout(() => { setLinkPickerOpen(false); setLinkQuery(''); }, 150)}
                            placeholder={loadingArtists ? 'Loading…' : 'Search artist…'}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white placeholder-stone-600 focus:outline-none w-32"
                          />
                          {linkQuery.length >= 1 && (allArtists ?? []).filter(a => a.name_display.toLowerCase().includes(linkQuery.toLowerCase())).length > 0 && (
                            <div className="absolute top-full left-0 mt-0.5 z-50 bg-stone-900 border border-white/15 rounded-lg shadow-xl overflow-hidden w-52 max-h-40 overflow-y-auto">
                              {(allArtists ?? [])
                                .filter(a => a.name_display.toLowerCase().includes(linkQuery.toLowerCase()))
                                .slice(0, 8)
                                .map(a => (
                                  <button
                                    key={a.id}
                                    onMouseDown={() => void linkArtist(selected, a.id)}
                                    className="w-full text-left px-2.5 py-1.5 text-[11px] text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
                                  >
                                    {a.name_display}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => void openLinkPicker()}
                          className="shrink-0 px-1.5 py-0.5 rounded text-[9px] text-stone-600 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 transition-colors"
                          title="Link artist"
                        >
                          + link
                        </button>
                      )}
                    </div>
                  </div>
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
                <div className="shrink-0 aspect-square flex">
                  {panelStatus === 'researching' ? (
                    <button onClick={stopEnrich}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[10px] font-semibold transition-colors">
                      <span>✕</span>
                      <span>Stop</span>
                    </button>
                  ) : songResearched ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                      <span className="text-sm">✓</span>
                      <span className="text-[9px]">Done</span>
                    </div>
                  ) : (
                    <button onClick={() => void enrichSong(selected)} disabled={batchRunning}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                      <span className="text-sm">✦</span>
                      <span>AI</span>
                    </button>
                  )}
                </div>

                {/* Save button */}
                <div className="shrink-0 aspect-square flex">
                  <button
                    onClick={() => void saveSelected()}
                    disabled={panelStatus === 'saving' || panelStatus === 'researching'}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition-colors disabled:opacity-40"
                  >
                    <span className="text-sm">{panelStatus === 'saving' ? '…' : '✓'}</span>
                    <span>{panelStatus === 'saving' ? 'Saving' : 'Save'}</span>
                  </button>
                </div>
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sources.slice(0, 6).map(src => (
                    <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-400 hover:text-white hover:border-white/30 transition-colors truncate max-w-48"
                      title={src.url}>
                      {src.title ?? src.url}
                    </a>
                  ))}
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
                    <Field label="Notes" value={draft.notes} onChange={v => setField('notes', v)} multiline />
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
                        <Field label="Non-YouTube URL"   value={draft.url}             onChange={v => setField('url', v)} placeholder="Bandcamp, SoundCloud, etc." />
                      </div>

                      {/* Right column */}
                      <div className="flex flex-col gap-4">
                        <SelectField label="Status"       value={draft.verification_status} onChange={v => setField('verification_status', v)} options={VERIFICATION_STATUSES} />
                        <SelectField label="Language"     value={draft.language}            onChange={v => setField('language', v)}            options={LANGUAGES} />
                        <SelectField label="Ethnic group" value={draft.ethnic_group}         onChange={v => setField('ethnic_group', v)}         options={LANGUAGES} />
                        <SelectField label="Genre"        value={draft.genre}                onChange={v => setField('genre', v)}                options={GENRES} />
                        <SelectField label="Performance"  value={draft.recording_type}       onChange={v => setField('recording_type', v)}       options={RECORDING_TYPES} />
                        <Field label="Location"           value={draft.location}             onChange={v => setField('location', v)} placeholder="Village or locality" />
                        <Field label="Region"             value={draft.region}               onChange={v => setField('region', v)} placeholder="e.g. Eastern Taiwan" />
                        <Field label="Tags (comma-separated)" value={draft.tags}             onChange={v => setField('tags', v)} placeholder="e.g. love-song, traditional" />
                      </div>
                    </div>

                    {/* Full-width fields below the grid */}
                    <Field label="Description (public)" value={draft.description} onChange={v => setField('description', v)} multiline
                      placeholder="Public-facing context shown to visitors" />
                  </div>
                )}

              {/* ── Lyrics section ──────────────────────────────────────────── */}
              {showLyrics && draft && (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <Field label="Notes" value={draft.notes} onChange={v => setField('notes', v)} multiline />
                  {/* Source + approval inline at top */}
                  <div className="flex items-end gap-3 shrink-0">
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
                  <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 [&>*]:h-full">
                    <Field label="Original" value={draft.lyrics_original} onChange={v => setField('lyrics_original', v)} multiline fill />
                    <Field label="Chinese"  value={draft.lyrics_zh}       onChange={v => setField('lyrics_zh', v)}       multiline fill />
                    <Field label="English"  value={draft.lyrics_en}       onChange={v => setField('lyrics_en', v)}       multiline fill />
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
