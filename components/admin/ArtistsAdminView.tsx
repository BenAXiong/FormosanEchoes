'use client';
import { useState, useEffect, useRef } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const ETHNIC_GROUPS = [
  'Amis', 'Atayal', 'Paiwan', 'Bunun', 'Puyuma', 'Rukai', 'Tsou',
  'Saisiyat', 'Tao (Yami)', 'Thao', 'Kavalan', 'Truku', 'Sakizaya',
  'Seediq', "Hla'alua", 'Kanakanavu',
];

const LANGUAGES = ETHNIC_GROUPS; // same 16 values for language select

const MISSING_LABELS: Record<string, string> = {
  no_bio:          'No bio',
  no_ethnic_group: 'No group',
  no_language:     'No lang',
  no_active_years: 'No years',
  no_links:        'No links',
  no_linked_songs: 'No songs',
};

const SCROLLBAR = '[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20';

// ── Types ─────────────────────────────────────────────────────────────────────

type ArtistRow = {
  id: string;
  name_display: string;
  names_zh: string[];
  names_en: string[];
  names_ab: string[];
  zh_surname: string | null;
  ethnic_groups: string[];
  language: string | null;
  is_group: boolean;
  active_years: string | null;
  bio_zh: string | null;
  bio_en: string | null;
  bio_ycm: string | null;
  youtube_channel: string | null;
  wikipedia_url: string | null;
  website_url: string | null;
  sources: string[];
  notes: string | null;
  photo_url: string | null;
  researched_fields: string[];
  group_ids: string[];
  member_ids: string[];
  song_count: number;
  missing: string[];
};

type ArtistDraft = {
  names_zh: string;
  names_en: string;
  names_ab: string;
  ethnic_groups: string[];
  language: string;
  is_group: boolean;
  active_years: string;
  bio_zh: string;
  bio_en: string;
  bio_ycm: string;
  youtube_channel: string;
  wikipedia_url: string;
  website_url: string;
  photo_url: string;
  sources: string;
  notes: string;
  researched_fields: string[];
};

type UnlinkedItem = { song_id: string; song_artist_string: string; song_title: string; yt_url: string; suggested_action: string };

type SongMini = {
  id: string;
  title: string;
  yt_title: string | null;
  title_original: string | null;
  artist_credit: string;
  linked_artists: { id: string; name_display: string }[];
};

type DupeMini = {
  id: string;
  name_display: string;
  names_zh: string[];
  names_en: string[];
  names_ab: string[];
  ethnic_groups: string[];
  language: string | null;
  is_group: boolean;
  photo_url: string | null;
  song_count: number;
};

type DupePair = {
  artist_a: DupeMini;
  artist_b: DupeMini;
  reason: 'name_overlap' | 'shared_song';
  confidence: 'high' | 'medium';
  suggested_keep: string;
  shared_names: string[];
  shared_songs: { id: string; title: string }[];
};

function draftFromArtist(a: ArtistRow): ArtistDraft {
  return {
    names_zh:          a.names_zh.join(', '),
    names_en:          a.names_en.join(', '),
    names_ab:          a.names_ab.join(', '),
    ethnic_groups:     [...a.ethnic_groups],
    language:          a.language        ?? '',
    is_group:          a.is_group,
    active_years:      a.active_years    ?? '',
    bio_zh:            a.bio_zh          ?? '',
    bio_en:            a.bio_en          ?? '',
    bio_ycm:           a.bio_ycm         ?? '',
    youtube_channel:   a.youtube_channel ?? '',
    wikipedia_url:     a.wikipedia_url   ?? '',
    website_url:       a.website_url     ?? '',
    photo_url:         a.photo_url       ?? '',
    sources:           a.sources.join(', '),
    notes:             a.notes           ?? '',
    researched_fields: [...(a.researched_fields ?? [])],
  };
}

const BLANK_DRAFT: ArtistDraft = {
  names_zh: '', names_en: '', names_ab: '',
  ethnic_groups: [], language: '', is_group: false,
  active_years: '', bio_zh: '', bio_en: '', bio_ycm: '',
  youtube_channel: '', wikipedia_url: '', website_url: '', photo_url: '', sources: '', notes: '',
  researched_fields: [],
};

function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('http')) return false;
  try {
    return /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(new URL(url).pathname);
  } catch { return false; }
}

function splitCSV(s: string): string[] {
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

const CJK = /[一-鿿㐀-䶿]/;

// Parse a single artist token into name fields.
// Handles three forms:
//   "王宏恩 (Biung Wang)" — outer+parenthetical
//   "HengJones 大亨"      — mixed Latin+CJK without parens → split on script boundary
//   pure CJK or pure Latin
function parseCreditToken(token: string): { names_zh: string; names_en: string; names_ab: string } {
  // Case 1: parenthetical
  const m = token.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (m) {
    const outer = m[1].trim(), inner = m[2].trim();
    return CJK.test(outer)
      ? { names_zh: outer, names_en: inner, names_ab: '' }
      : { names_zh: '', names_en: outer, names_ab: inner };
  }
  // Case 2: mixed — strip CJK to get Latin part, strip Latin+punctuation to get CJK part
  const cjkPart  = token.replace(/[^一-鿿㐀-䶿豈-﫿]/g, '').trim();
  const latinPart = token.replace(/[一-鿿㐀-䶿豈-﫿]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cjkPart && latinPart) return { names_zh: cjkPart, names_en: latinPart, names_ab: '' };
  // Case 3: pure
  return CJK.test(token)
    ? { names_zh: token, names_en: '', names_ab: '' }
    : { names_zh: '', names_en: token, names_ab: '' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline = false, placeholder, fill = false }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; fill?: boolean;
}>) {
  const cls = `w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none ${fill ? 'flex-1 min-h-0' : ''} ${SCROLLBAR}`;
  return (
    <div className={`flex flex-col gap-1 ${fill ? 'h-full' : ''}`}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={fill ? undefined : 3} className={cls} />
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

function MissingBadge({ label }: Readonly<{ label: string }>) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap leading-tight bg-orange-900/40 text-orange-400 border-orange-700/40">
      {MISSING_LABELS[label] ?? label}
    </span>
  );
}

function AvatarCircle({ artist }: Readonly<{ artist: { name_display: string; photo_url: string | null; ethnic_groups: string[] } }>) {
  const GROUP_COLORS: Record<string, string> = {
    Amis: 'bg-amber-700', Atayal: 'bg-rose-700', Paiwan: 'bg-violet-700',
    Bunun: 'bg-teal-700', Puyuma: 'bg-emerald-700', Rukai: 'bg-lime-700',
    'Tao (Yami)': 'bg-sky-700', Seediq: 'bg-orange-700', Truku: 'bg-cyan-700',
  };
  const color = GROUP_COLORS[artist.ethnic_groups[0] ?? ''] ?? 'bg-stone-600';
  return (
    <div className={`relative shrink-0 w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold select-none overflow-hidden`}>
      {artist.name_display[0] ?? '?'}
      {artist.photo_url && (
        <img
          src={artist.photo_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArtistsAdminView({ filters }: { filters?: { ethnic_group?: string; artist_missing_field?: string } }) {
  const [artists, setArtists]           = useState<ArtistRow[]>([]);
  const [loading, setLoading]           = useState(false);
  const [query, setQuery]               = useState('');
  const [filterType, setFilterType]     = useState<'all' | 'individual' | 'groups'>('all');
  const [railOpen, setRailOpen]         = useState(true);

  const [selected, setSelected]         = useState<ArtistRow | null>(null);
  const [isNew, setIsNew]               = useState(true);
  const [draft, setDraft]               = useState<ArtistDraft | null>({ ...BLANK_DRAFT });
  const [panelSection, setPanelSection] = useState<'metadata' | 'bio'>('metadata');
  const [newArtistName, setNewArtistName] = useState('');
  const [panelStatus, setPanelStatus]   = useState<'idle' | 'researching' | 'saving' | 'saved' | 'error'>('idle');
  const [panelMessage, setPanelMessage] = useState('');
  const [artistResearched, setArtistResearched] = useState(false);

  const [unlinked, setUnlinked]         = useState<UnlinkedItem[]>([]);
  const [railTab, setRailTab]           = useState<'all' | 'unlinked'>('all');
  const [sourceSongId, setSourceSongId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; elapsed: number; title: string; failed: number } | null>(null);
  const [batchReport, setBatchReport]   = useState<{ succeeded: number; failed: number; failedNames: string[]; aborted: boolean } | null>(null);
  const abortRef                        = useRef(false);
  const elapsedRef                      = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchStatsRef                   = useRef({ succeeded: 0, failed: 0, failedNames: [] as string[] });

  // N/A filter
  const [naFilter, setNaFilter]             = useState(false);

  // Duplicate detection
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [dupePairs, setDupePairs]           = useState<DupePair[]>([]);
  const [dupeLoading, setDupeLoading]       = useState(false);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [expandedPairs, setExpandedPairs]   = useState<Set<string>>(new Set());

  // Song picker (linked songs section)
  const [allSongs, setAllSongs]           = useState<SongMini[] | null>(null);
  const [loadingSongs, setLoadingSongs]   = useState(false);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songQuery, setSongQuery]         = useState('');

  // Member management
  const [memberQuery, setMemberQuery]   = useState('');
  const [memberDropdown, setMemberDropdown] = useState(false);
  const memberInputRef                  = useRef<HTMLInputElement>(null);

  // Photo URL server-side check (debounced)
  const [photoCheck, setPhotoCheck]     = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const photoCheckTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (photoCheckTimer.current) clearTimeout(photoCheckTimer.current);
    const url = draft?.photo_url ?? '';
    if (!isValidImageUrl(url)) { setPhotoCheck('idle'); return; }
    setPhotoCheck('checking');
    photoCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/check-image?url=${encodeURIComponent(url)}`);
        const data = await res.json() as { ok: boolean };
        setPhotoCheck(data.ok ? 'ok' : 'bad');
      } catch { setPhotoCheck('bad'); }
    }, 600);
    return () => { if (photoCheckTimer.current) clearTimeout(photoCheckTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.photo_url]);


  const setField = <K extends keyof ArtistDraft>(key: K, value: ArtistDraft[K]) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchArtists(): Promise<ArtistRow[]> {
    setLoading(true);
    try {
      const [artistRes, unlinkedRes] = await Promise.all([
        fetch('/api/admin/all-artists'),
        fetch('/api/admin/unlinked-artists'),
      ]);
      const artistData = await artistRes.json() as ArtistRow[];
      const unlinkedData = await unlinkedRes.json();
      if (Array.isArray(artistData)) setArtists(artistData);
      if (Array.isArray(unlinkedData)) setUnlinked(unlinkedData);
      return Array.isArray(artistData) ? artistData : [];
    } catch (err) { console.error(err); return []; }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchArtists(); }, []);

  // ── Selection ────────────────────────────────────────────────────────────────

  function deselect() {
    setSelected(null); setIsNew(true); setDraft({ ...BLANK_DRAFT });
    setPanelStatus('idle'); setPanelMessage('');
    setArtistResearched(false); setMemberQuery(''); setSourceSongId(null);
    setSongPickerOpen(false); setSongQuery('');     setNewArtistName('');
  }

  function handleArtistClick(artist: ArtistRow) {
    setShowDuplicates(false);
    if (!isNew && selected?.id === artist.id) { deselect(); return; }
    setSelected(artist); setIsNew(false);
    setDraft(draftFromArtist(artist));
    setPanelStatus('idle'); setPanelMessage('');
    setArtistResearched(false); setMemberQuery('');
    setSongPickerOpen(false); setSongQuery('');     void loadSongs();
  }

  async function handleDeleteArtist(artist: ArtistRow) {
    const label = artist.name_display || artist.names_en[0] || artist.id;
    const warning = artist.song_count > 0
      ? `"${label}" has ${artist.song_count} linked song${artist.song_count !== 1 ? 's' : ''} — deleting will unlink them. Continue?`
      : `Delete "${label}"?`;
    if (!confirm(warning)) return;
    const res = await fetch('/api/admin/delete-artist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: artist.id }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Delete failed'); return; }
    setArtists(prev => prev.filter(a => a.id !== artist.id));
    if (selected?.id === artist.id) deselect();
  }

  // ── Auto-link ────────────────────────────────────────────────────────────────

  async function handleAutoLink() {
    setPanelMessage('Auto-linking…');
    const res = await fetch('/api/admin/auto-link', { method: 'POST' });
    const data = await res.json();
    setPanelMessage(res.ok ? (data.linked > 0 ? `✓ ${data.linked} song(s) linked` : '✓ No new matches') : `Error: ${data.error}`);
    fetchArtists();
  }

  // ── Research single ──────────────────────────────────────────────────────────

  async function researchArtist(name: string, yt_url?: string, song_title?: string) {
    setArtistResearched(false);
    setPanelStatus('researching');
    setPanelMessage('');
    try {
      const res = await fetch('/api/admin/research-artist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: name, force: true, yt_url: yt_url ?? '', song_title: song_title ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Research failed');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = data.research as Record<string, any>;
      const groundingSources: string[] = data.sources ?? [];
      setDraft(d => {
        if (!d) return d;
        const aiLabel = `[AI — ${new Date().toISOString().slice(0, 10)}]`;
        const newEthnic   = Array.isArray(r.ethnic_groups) && r.ethnic_groups.length ? r.ethnic_groups : d.ethnic_groups;
        const newLang     = r.language        || d.language;
        const newYears    = r.active_years    || d.active_years;
        const newBioZh    = r.bio_zh ? `${r.bio_zh}\n\n${aiLabel}` : d.bio_zh;
        const newBioEn    = r.bio_en ? `${r.bio_en}\n\n${aiLabel}` : d.bio_en;
        const newYT       = r.youtube_channel || d.youtube_channel;
        const newWP       = r.wikipedia_url   || d.wikipedia_url;

        // Auto-N/A any field that was empty before AND came back empty from AI
        const autoNA = new Set(d.researched_fields);
        if (!newBioEn && !newBioZh)  autoNA.add('no_bio');
        if (!newEthnic.length)        autoNA.add('no_ethnic_group');
        if (!newLang)                 autoNA.add('no_language');
        if (!newYears)                autoNA.add('no_active_years');
        if (!newYT && !newWP)         autoNA.add('no_links');

        return {
          ...d,
          names_zh:          Array.isArray(r.names_zh) ? r.names_zh.join(', ') : d.names_zh,
          names_en:          Array.isArray(r.names_en) ? r.names_en.join(', ') : d.names_en,
          names_ab:          Array.isArray(r.names_ab) ? r.names_ab.join(', ') : d.names_ab,
          ethnic_groups:     newEthnic,
          language:          newLang,
          is_group:          r.is_group ?? d.is_group,
          active_years:      newYears,
          bio_zh:            newBioZh,
          bio_en:            newBioEn,
          youtube_channel:   newYT,
          wikipedia_url:     newWP,
          photo_url:         isValidImageUrl(r.photo_url) ? r.photo_url : d.photo_url,
          sources:           [
            ...splitCSV(d.sources),
            ...(Array.isArray(r.sources) ? r.sources : []),
            ...groundingSources,
          ].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', '),
          notes:             r.notes || d.notes,
          researched_fields: [...autoNA],
        };
      });
      setArtistResearched(true);
      setPanelStatus('idle');
      setPanelMessage('');
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Research failed');
    }
  }

  // ── Batch research (unlinked) ────────────────────────────────────────────────

  function stopBatch() {
    abortRef.current = true;
    setBatchRunning(false);
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
    setBatchReport({ ...batchStatsRef.current, aborted: true });
    fetchArtists();
  }

  async function handleBatchResearch() {
    const candidates = unlinked.filter(i => i.song_artist_string !== 'Unknown / Traditional');
    if (!candidates.length) return;
    if (candidates.length > 10 && !window.confirm(
      `Research all ${candidates.length} unlinked artists? This will make ${candidates.length} AI calls.`
    )) return;
    abortRef.current = false;
    batchStatsRef.current = { succeeded: 0, failed: 0, failedNames: [] };
    setBatchReport(null);
    setBatchRunning(true);
    let consecutiveFails = 0;

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      if (abortRef.current) break;

      const startTime = Date.now();
      setBatchProgress({ current: i + 1, total: candidates.length, elapsed: 0, title: item.song_artist_string, failed: batchStatsRef.current.failed });
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setBatchProgress(p => p ? { ...p, elapsed: Math.floor((Date.now() - startTime) / 1000) } : null);
      }, 1000);

      let callSucceeded = false;
      try {
        const res = await fetch('/api/admin/research-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: item.song_artist_string, yt_url: item.yt_url, song_title: item.song_title }),
        });
        const data = await res.json();
        if (res.ok && data.research) {
          await fetch('/api/admin/save-artist', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data.research, link_song_id: item.song_id }),
          });
          callSucceeded = true;
          consecutiveFails = 0;
        } else if (res.status >= 500) {
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch { /* network error */ }

      if (callSucceeded) {
        batchStatsRef.current.succeeded++;
      } else {
        consecutiveFails++;
        batchStatsRef.current.failed++;
        batchStatsRef.current.failedNames.push(item.song_artist_string);
        setBatchProgress(p => p ? { ...p, failed: batchStatsRef.current.failed } : p);
        if (consecutiveFails >= 3) { abortRef.current = true; }
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
    setBatchRunning(false);
    setBatchReport({ ...batchStatsRef.current, aborted: abortRef.current });
    fetchArtists();
  }

  // ── Batch research (all filtered) ───────────────────────────────────────────

  async function handleBatchResearchAll() {
    const candidates = filtered.filter(a => a.missing.length > 0);
    if (!candidates.length) return;
    if (candidates.length > 10 && !window.confirm(
      `Research all ${candidates.length} artists? This will make ${candidates.length} AI calls.`
    )) return;
    abortRef.current = false;
    batchStatsRef.current = { succeeded: 0, failed: 0, failedNames: [] };
    setBatchReport(null);
    setBatchRunning(true);
    let consecutiveFails = 0;

    for (let i = 0; i < candidates.length; i++) {
      const artist = candidates[i];
      if (abortRef.current) break;

      const startTime = Date.now();
      setBatchProgress({ current: i + 1, total: candidates.length, elapsed: 0, title: artist.name_display, failed: batchStatsRef.current.failed });
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setBatchProgress(p => p ? { ...p, elapsed: Math.floor((Date.now() - startTime) / 1000) } : null);
      }, 1000);

      let callSucceeded = false;
      try {
        const name = artist.names_en[0] ?? artist.names_zh[0] ?? artist.names_ab[0] ?? artist.name_display;
        const res = await fetch('/api/admin/research-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: name, force: true }),
        });
        const data = await res.json();
        if (!res.ok || !data.research) {
          if (res.status >= 500) await new Promise(r => setTimeout(r, 5000));
        } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rd = data.research as Record<string, any>;
        const groundingSources: string[] = data.sources ?? [];
        const mergedSources = [...new Set([
          ...artist.sources,
          ...(Array.isArray(rd.sources) ? rd.sources : []),
          ...groundingSources,
        ])].filter(Boolean);
        const aiLabel = `[AI — ${new Date().toISOString().slice(0, 10)}]`;

        // Compute merged values to know which fields the AI filled
        const mergedEthnic   = Array.isArray(rd.ethnic_groups) && rd.ethnic_groups.length ? rd.ethnic_groups : artist.ethnic_groups;
        const mergedLang     = rd.language        || artist.language;
        const mergedYears    = rd.active_years    || artist.active_years;
        const mergedBioEn    = rd.bio_en          || artist.bio_en;
        const mergedBioZh    = rd.bio_zh          || artist.bio_zh;
        const mergedYT       = rd.youtube_channel || artist.youtube_channel;
        const mergedWP       = rd.wikipedia_url   || artist.wikipedia_url;

        // Auto-N/A fields that are still empty after research
        const autoNA = new Set(artist.researched_fields);
        if (!mergedBioEn && !mergedBioZh)   autoNA.add('no_bio');
        if (!mergedEthnic.length)            autoNA.add('no_ethnic_group');
        if (!mergedLang)                     autoNA.add('no_language');
        if (!mergedYears)                    autoNA.add('no_active_years');
        if (!mergedYT && !mergedWP)          autoNA.add('no_links');

        await fetch('/api/admin/update-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist_id: artist.id,
            fields: {
              names_zh:          Array.isArray(rd.names_zh) && rd.names_zh.length ? rd.names_zh : artist.names_zh,
              names_en:          Array.isArray(rd.names_en) && rd.names_en.length ? rd.names_en : artist.names_en,
              names_ab:          Array.isArray(rd.names_ab) && rd.names_ab.length ? rd.names_ab : artist.names_ab,
              ethnic_groups:     mergedEthnic,
              language:          mergedLang,
              is_group:          rd.is_group ?? artist.is_group,
              active_years:      mergedYears,
              bio_zh:            rd.bio_zh ? `${rd.bio_zh}\n\n${aiLabel}` : artist.bio_zh,
              bio_en:            rd.bio_en ? `${rd.bio_en}\n\n${aiLabel}` : artist.bio_en,
              bio_ycm:           artist.bio_ycm,
              youtube_channel:   mergedYT,
              wikipedia_url:     mergedWP,
              photo_url:         isValidImageUrl(rd.photo_url) ? rd.photo_url : artist.photo_url,
              sources:           mergedSources,
              notes:             artist.notes,
              researched_fields: [...autoNA],
            },
          }),
        });
          callSucceeded = true;
          consecutiveFails = 0;
        }
      } catch { /* network error */ }

      if (callSucceeded) {
        batchStatsRef.current.succeeded++;
      } else {
        consecutiveFails++;
        batchStatsRef.current.failed++;
        batchStatsRef.current.failedNames.push(artist.name_display);
        setBatchProgress(p => p ? { ...p, failed: batchStatsRef.current.failed } : p);
        if (consecutiveFails >= 3) { abortRef.current = true; }
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    setBatchProgress(null);
    setBatchRunning(false);
    setBatchReport({ ...batchStatsRef.current, aborted: abortRef.current });
    fetchArtists();
  }

  // ── Duplicate detection & merge ─────────────────────────────────────────────

  async function checkDuplicates() {
    setShowDuplicates(true);
    setRailOpen(false);
    setDupePairs([]);
    setDismissedPairs(new Set());
    setDupeLoading(true);
    try {
      const res = await fetch('/api/admin/potential-duplicates');
      const data = await res.json() as DupePair[];
      setDupePairs(Array.isArray(data) ? data : []);
    } catch { setDupePairs([]); }
    finally { setDupeLoading(false); }
  }

  function dismissPair(aId: string, bId: string) {
    const key = [aId, bId].sort().join('|');
    setDismissedPairs(prev => new Set([...prev, key]));
    setDupePairs(prev => prev.filter(p => [p.artist_a.id, p.artist_b.id].sort().join('|') !== key));
  }

  async function mergePair(keepId: string, mergeId: string) {
    const res = await fetch('/api/admin/merge-artists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }),
    });
    if (res.ok) {
      dismissPair(keepId, mergeId);
      // If the merged artist was selected in the form, clear it
      if (selected?.id === mergeId) deselect();
      fetchArtists();
    } else {
      const d = await res.json() as { error?: string };
      alert(d.error ?? 'Merge failed');
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function saveArtist() {
    if (!draft) return;
    setPanelStatus('saving');
    setPanelMessage('');
    try {
      const names_ab = splitCSV(draft.names_ab);
      const names_en = splitCSV(draft.names_en);
      const names_zh = splitCSV(draft.names_zh);
      const payload = {
        name_display:    names_ab[0] ?? names_en[0] ?? names_zh[0] ?? '',
        names_zh,
        names_en,
        names_ab,
        zh_surname:      null,
        ethnic_groups:   draft.ethnic_groups,
        language:        draft.language        || null,
        is_group:        draft.is_group,
        active_years:    draft.active_years    || null,
        bio_zh:          draft.bio_zh          || null,
        bio_en:          draft.bio_en          || null,
        bio_ycm:         draft.bio_ycm         || null,
        youtube_channel: draft.youtube_channel || null,
        wikipedia_url:   draft.wikipedia_url   || null,
        website_url:     draft.website_url     || null,
        photo_url:       draft.photo_url       || null,
        sources:           splitCSV(draft.sources),
        notes:             draft.notes           || null,
        researched_fields: draft.researched_fields,
      };

      if (isNew) {
        const res = await fetch('/api/admin/save-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...(sourceSongId ? { link_song_id: sourceSongId } : {}) }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Save failed');
        const saved = json.saved as { id: string; name_display: string };
        setPanelStatus('saved');
        setPanelMessage(`✓ Created "${saved.name_display}"`);
        const freshList = await fetchArtists();
        const updated = freshList.find(a => a.id === saved.id);
        if (updated) { setSelected(updated); setIsNew(false); setDraft(draftFromArtist(updated)); }
      } else if (selected) {
        const res = await fetch('/api/admin/update-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_id: selected.id, fields: payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Save failed');
        setPanelStatus('saved');
        setPanelMessage('✓ Saved.');
        const savedId = selected.id;
        const freshList = await fetchArtists();
        const updated = freshList.find(a => a.id === savedId);
        if (updated) { setSelected(updated); setDraft(draftFromArtist(updated)); }
      }
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }

  // ── Researched N/A toggle ────────────────────────────────────────────────────

  async function toggleNA(fieldKey: string) {
    if (!selected || isNew || !draft) return;
    const updated = draft.researched_fields.includes(fieldKey)
      ? draft.researched_fields.filter(f => f !== fieldKey)
      : [...draft.researched_fields, fieldKey];
    setDraft(d => d ? { ...d, researched_fields: updated } : d);
    await fetch('/api/admin/update-artist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: selected.id, fields: { researched_fields: updated } }),
    });
    const savedId = selected.id;
    const freshList = await fetchArtists();
    const refreshed = freshList.find(a => a.id === savedId);
    if (refreshed) {
      setSelected(refreshed);
      setDraft(d => d ? { ...d, researched_fields: refreshed.researched_fields } : d);
    }
  }

  async function naAll(fields: string[]) {
    if (!selected || isNew || !draft) return;
    const updated = [...new Set([...draft.researched_fields, ...fields])];
    setDraft(d => d ? { ...d, researched_fields: updated } : d);
    await fetch('/api/admin/update-artist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: selected.id, fields: { researched_fields: updated } }),
    });
    const savedId = selected.id;
    const freshList = await fetchArtists();
    const refreshed = freshList.find(a => a.id === savedId);
    if (refreshed) {
      setSelected(refreshed);
      setDraft(d => d ? { ...d, researched_fields: refreshed.researched_fields } : d);
    }
  }

  // ── Member management ────────────────────────────────────────────────────────

  async function removeMember(memberId: string) {
    if (!selected) return;
    const newIds = (selected.member_ids ?? []).filter(id => id !== memberId);
    const res = await fetch('/api/admin/update-artist-members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_artist_id: selected.id, member_artist_ids: newIds }),
    });
    if (res.ok) fetchArtists();
  }

  async function addMember(memberId: string) {
    if (!selected) return;
    const newIds = [...new Set([...(selected.member_ids ?? []), memberId])];
    const res = await fetch('/api/admin/update-artist-members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_artist_id: selected.id, member_artist_ids: newIds }),
    });
    if (res.ok) { setMemberQuery(''); setMemberDropdown(false); fetchArtists(); }
  }

  // ── Song linking ─────────────────────────────────────────────────────────────

  async function loadSongs() {
    if (allSongs !== null || loadingSongs) return;
    setLoadingSongs(true);
    try {
      const res = await fetch('/api/admin/unaudited-songs?all=true');
      const data = await res.json() as SongMini[];
      if (Array.isArray(data)) setAllSongs(data);
    } finally {
      setLoadingSongs(false);
    }
  }

  async function linkSong(songId: string) {
    if (!selected || isNew) return;
    const res = await fetch('/api/admin/link-song-artist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId, artist_id: selected.id }),
    });
    if (res.ok) {
      setAllSongs(prev => prev ? prev.map(s => s.id === songId
        ? { ...s, linked_artists: [...s.linked_artists, { id: selected.id, name_display: selected.name_display }] }
        : s
      ) : prev);
      setSelected(prev => prev ? { ...prev, song_count: (prev.song_count ?? 0) + 1 } : prev);
      setSongPickerOpen(false);
      setSongQuery('');
    }
  }

  async function unlinkSong(songId: string) {
    if (!selected || isNew) return;
    const res = await fetch('/api/admin/link-song-artist', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId, artist_id: selected.id }),
    });
    if (res.ok) {
      setAllSongs(prev => prev ? prev.map(s => s.id === songId
        ? { ...s, linked_artists: s.linked_artists.filter(a => a.id !== selected.id) }
        : s
      ) : prev);
      setSelected(prev => prev ? { ...prev, song_count: Math.max(0, (prev.song_count ?? 0) - 1) } : prev);
    }
  }

  async function rescanSongs() {
    if (!selected || isNew) return;
    const res = await fetch('/api/admin/rescan-artist-songs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_id: selected.id }),
    });
    const data = await res.json() as { linked?: number; error?: string };
    if (res.ok) {
      setPanelMessage(`✓ Rescan: ${data.linked ?? 0} match${(data.linked ?? 0) !== 1 ? 'es' : ''} found`);
      setAllSongs(null); // invalidate cache so linked songs refresh on next open
      fetchArtists();
    } else {
      setPanelMessage(`Rescan error: ${data.error ?? 'unknown'}`);
    }
  }

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = artists.filter(a => {
    if (filterType === 'individual' && a.is_group) return false;
    if (filterType === 'groups' && !a.is_group) return false;
    if (naFilter && a.researched_fields.length === 0) return false;
    if (filters?.ethnic_group && !a.ethnic_groups.includes(filters.ethnic_group)) return false;
    const fm = filters?.artist_missing_field ?? '';
    if (fm === 'any' && a.missing.length === 0) return false;
    if (fm === 'any_except_songs' && !a.missing.some(m => m !== 'no_linked_songs')) return false;
    if (fm && fm !== 'any' && fm !== 'any_except_songs' && !a.missing.includes(fm)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return a.name_display.toLowerCase().includes(q)
      || a.names_zh.some(n => n.toLowerCase().includes(q))
      || a.names_en.some(n => n.toLowerCase().includes(q))
      || a.names_ab.some(n => n.toLowerCase().includes(q));
  });

  // Member type-ahead: filter all artists excluding already-members and self
  const memberSuggestions = memberQuery.trim()
    ? artists.filter(a => {
        if (!memberQuery.trim()) return false;
        if (selected && a.id === selected.id) return false;
        if (selected?.member_ids?.includes(a.id)) return false;
        const q = memberQuery.toLowerCase();
        return a.name_display.toLowerCase().includes(q)
          || a.names_en.some(n => n.toLowerCase().includes(q))
          || a.names_zh.some(n => n.toLowerCase().includes(q));
      }).slice(0, 6)
    : [];

  // ── Derived ──────────────────────────────────────────────────────────────────

  const linkedSongs = selected && !isNew && allSongs
    ? allSongs.filter(s => s.linked_artists.some(a => a.id === selected.id))
    : [];

  const songPickerResults = songQuery.length >= 1 && allSongs
    ? allSongs
        .filter(s => {
          if (linkedSongs.some(l => l.id === s.id)) return false;
          const q = songQuery.toLowerCase();
          return (s.title_original ?? s.yt_title ?? s.title).toLowerCase().includes(q)
            || s.artist_credit.toLowerCase().includes(q);
        })
        .slice(0, 8)
    : [];

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasDraft = !!draft;
  const showPanel = hasDraft;

  return (
    <div className="bg-[#0f0f16] rounded-xl border border-white/10 overflow-hidden flex flex-col h-full min-h-130">
      <div
        className="relative grid h-full"
        style={{ gridTemplateColumns: railOpen ? '450px 1fr' : '12px 1fr' }}
      >
        {/* Chevron handle */}
        <button
          onClick={() => setRailOpen(o => !o)}
          style={{ left: railOpen ? '450px' : '12px' }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-4 h-9 flex items-center justify-center bg-stone-900 border border-white/10 rounded text-[11px] text-stone-500 hover:text-white hover:bg-stone-800 hover:border-white/25 transition-colors select-none"
          title={railOpen ? 'Collapse' : 'Expand'}
        >
          {railOpen ? '‹' : '›'}
        </button>

        {/* ── Left rail ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden border-r border-white/5">
          {railOpen && (
            <>
              {/* Toolbar */}
              <div className="px-3 py-2.5 flex flex-col gap-2 border-b border-white/5 shrink-0">
                {/* Row 1: Search + Research All */}
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search artists…"
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  {batchRunning ? (
                    <button onClick={stopBatch}
                      className="text-[10px] px-2 py-1.5 rounded border bg-red-500/20 border-red-500/30 text-red-400 whitespace-nowrap shrink-0">
                      ✕ Stop
                    </button>
                  ) : (
                    <button
                      onClick={railTab === 'unlinked' ? handleBatchResearch : handleBatchResearchAll}
                      className="text-[10px] px-2 py-1.5 rounded border bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors whitespace-nowrap shrink-0">
                      ✦ Research All
                    </button>
                  )}
                </div>
                {/* Row 2: All|Unlinked tabs + type filter + actions */}
                <div className="flex items-center gap-2">
                  {/* filtered / total counter */}
                  <span className="text-[10px] tabular-nums text-stone-600 shrink-0 font-mono">
                    {railTab === 'all' ? `${filtered.length}/${artists.length}` : `${unlinked.length}`}
                  </span>
                  {/* All | Unlinked tabs */}
                  <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] shrink-0">
                    {(['all', 'unlinked'] as const).map(t => (
                      <button key={t} onClick={() => setRailTab(t)}
                        className={`px-2 py-1 transition-colors ${railTab === t ? 'bg-white/15 text-white' : 'bg-white/3 text-stone-500 hover:bg-white/8'}`}>
                        {t === 'all' ? 'All' : unlinked.length > 0 ? `Unlinked (${unlinked.length})` : 'Unlinked'}
                      </button>
                    ))}
                  </div>

                  {/* Solo | Groups + Check Dupes — only in All tab */}
                  {railTab === 'all' && (
                    <>
                      <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] shrink-0">
                        {(['all', 'individual', 'groups'] as const).map(t => (
                          <button key={t} onClick={() => setFilterType(t)}
                            className={`px-2 py-1 transition-colors ${filterType === t ? 'bg-white/15 text-white' : 'bg-white/3 text-stone-500 hover:bg-white/8'}`}>
                            {t === 'all' ? 'All' : t === 'individual' ? 'Solo' : 'Groups'}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setNaFilter(f => !f)}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors whitespace-nowrap shrink-0 ${
                          naFilter
                            ? 'bg-stone-500/30 border-stone-400/30 text-stone-200'
                            : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                        }`}>
                        N/A&apos;d
                      </button>
                      <button
                        onClick={() => void checkDuplicates()}
                        disabled={batchRunning}
                        className="text-[10px] px-2 py-1 rounded border bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors whitespace-nowrap ml-auto shrink-0">
                        ⊕ Dupes
                      </button>
                    </>
                  )}


                  {railTab === 'unlinked' && (
                    <button onClick={handleAutoLink}
                      className="text-[10px] px-2 py-1 rounded border bg-white/5 border-white/10 text-stone-300 hover:bg-white/10 transition-colors whitespace-nowrap ml-auto shrink-0">
                      ⚡ Auto-link
                    </button>
                  )}
                </div>

                {/* Batch progress */}
                {batchRunning && batchProgress && (
                  <div className="flex flex-col gap-1">
                    <div className="w-full h-0.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 transition-all duration-500 rounded-full"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-stone-500 truncate">
                      <span className="text-stone-300 font-mono tabular-nums">{batchProgress.current}/{batchProgress.total}</span>
                      {' · '}<span className="truncate">{batchProgress.title}</span>
                      {' · '}<span className={batchProgress.elapsed >= 70 ? 'text-amber-400' : ''}>{batchProgress.elapsed}s{batchProgress.elapsed >= 70 ? ' ⚠' : ''}</span>
                      {batchProgress.failed > 0 && <span className="text-red-400 ml-1">· {batchProgress.failed} failed</span>}
                    </p>
                  </div>
                )}
                {/* Batch report */}
                {!batchRunning && batchReport && (
                  <div className="flex items-start gap-2 bg-stone-800/60 border border-white/10 rounded-lg px-2.5 py-1.5">
                    <p className="flex-1 text-[10px] leading-relaxed">
                      <span className="text-stone-400">{batchReport.aborted ? 'Stopped' : 'Done'} — </span>
                      <span className="text-emerald-400">{batchReport.succeeded} saved</span>
                      {batchReport.failed > 0 && (
                        <span className="text-red-400">
                          {', '}{batchReport.failed} failed: {batchReport.failedNames.slice(0, 3).join(', ')}{batchReport.failedNames.length > 3 ? ` +${batchReport.failedNames.length - 3} more` : ''}
                        </span>
                      )}
                    </p>
                    <button onClick={() => setBatchReport(null)} className="text-stone-600 hover:text-stone-400 transition-colors shrink-0 text-[10px] leading-none mt-0.5">✕</button>
                  </div>
                )}
              </div>

              {/* List — tabbed: All artists or Unlinked queue */}
              {railTab === 'all' ? (
                <div className={`flex-1 overflow-y-auto divide-y divide-white/5 ${SCROLLBAR}`}>
                  {loading && <p className="text-stone-600 text-xs italic px-4 py-3">Loading…</p>}
                  {!loading && filtered.length === 0 && (
                    <p className="text-stone-600 text-xs italic px-4 py-3">No artists match.</p>
                  )}
                  {filtered.map(artist => (
                    <div key={artist.id} className={`flex items-center gap-2.5 px-3 py-2 transition-colors border-l-2 ${
                      !isNew && selected?.id === artist.id ? 'bg-white/8 border-violet-500' : 'hover:bg-white/3 border-transparent'
                    }`}>
                      <button onClick={() => handleArtistClick(artist)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                        <AvatarCircle artist={artist} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-white leading-tight">{artist.name_display}</p>
                          {(artist.names_ab[0] || artist.names_zh[0]) && (
                            <p className="text-stone-400 text-[10px] truncate leading-tight">
                              {[artist.names_ab[0], artist.names_zh[0]].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <p className="text-stone-600 text-[10px] truncate">
                            {[artist.ethnic_groups[0], artist.language].filter(Boolean).join(' · ') || '—'}
                            {artist.is_group && <span className="ml-1 text-sky-500">group</span>}
                            {' '}<span className="text-stone-700">{artist.song_count} song{artist.song_count !== 1 ? 's' : ''}</span>
                          </p>
                        </div>
                        {(() => {
                          const naVisible = naFilter ? artist.researched_fields.filter(m => m !== 'no_linked_songs') : [];
                          const total = artist.missing.length + naVisible.length;
                          if (total === 0) return null;
                          const shownMissing = artist.missing.slice(0, 2);
                          const shownNa = naVisible.slice(0, Math.max(0, 2 - shownMissing.length));
                          const overflow = total - shownMissing.length - shownNa.length;
                          return (
                            <div className="flex gap-0.5 flex-wrap justify-end shrink-0 max-w-24">
                              {shownMissing.map(m => <MissingBadge key={m} label={m} />)}
                              {shownNa.map(m => (
                                <span key={`na-${m}`} className="px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap leading-tight bg-stone-800/60 text-stone-500 border-stone-700/30 line-through decoration-stone-600">
                                  {MISSING_LABELS[m] ?? m}
                                </span>
                              ))}
                              {overflow > 0 && <span className="text-[8px] text-stone-600 self-center">+{overflow}</span>}
                            </div>
                          );
                        })()}
                      </button>
                      <button
                        onClick={() => { handleArtistClick(artist); researchArtist(artist.name_display); }}
                        title="Research with AI"
                        className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors"
                      >
                        ✦
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); void handleDeleteArtist(artist); }}
                        title="Delete artist"
                        className="shrink-0 p-1 rounded text-stone-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                          <path d="M6.5 1h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1zM11 3H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-3 2a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5A.5.5 0 0 1 8 5zm-2 0a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5A.5.5 0 0 1 6 5zm4 0a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0v-5A.5.5 0 0 1 10 5z"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`flex-1 overflow-y-auto divide-y divide-white/5 ${SCROLLBAR}`}>
                  {loading && <p className="text-stone-600 text-xs italic px-4 py-3">Loading…</p>}
                  {!loading && unlinked.length === 0 && (
                    <p className="text-stone-600 text-xs italic px-4 py-3">No unlinked artist credits.</p>
                  )}
                  {unlinked.map((item, i) => {
                    const openUnlinkedItem = () => {
                      const stub: ArtistRow = {
                        id: '', name_display: item.song_artist_string, names_zh: [], names_en: [], names_ab: [],
                        zh_surname: null, ethnic_groups: [], language: null, is_group: false, active_years: null,
                        bio_zh: null, bio_en: null, bio_ycm: null, youtube_channel: null, wikipedia_url: null, website_url: null,
                        sources: [], notes: null, photo_url: null, researched_fields: [], group_ids: [], member_ids: [],
                        song_count: 0, missing: [],
                      };
                      setSelected(stub); setIsNew(true); setSourceSongId(item.song_id);
                      setDraft({ ...BLANK_DRAFT, ...parseCreditToken(item.song_artist_string.split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)[0].trim()) });
                      setNewArtistName(item.song_artist_string);
                      setPanelStatus('idle'); setPanelMessage('');
                    };
                    return (
                      <div key={i} className={`flex items-center gap-2.5 px-3 py-2 transition-colors border-l-2 ${
                        isNew && selected?.name_display === item.song_artist_string ? 'bg-white/8 border-violet-500' : 'hover:bg-white/3 border-transparent'
                      }`}>
                        <button onClick={openUnlinkedItem} className="flex-1 min-w-0 pr-2 text-left">
                          <p className="text-white text-xs font-medium truncate">{item.song_artist_string}</p>
                          <p className="text-stone-600 text-[10px] truncate">{item.song_title}</p>
                        </button>
                        <button
                          onClick={() => { openUnlinkedItem(); void researchArtist(item.song_artist_string, item.yt_url, item.song_title); }}
                          title="Research with AI"
                          className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[9px] font-bold transition-colors"
                        >
                          ✦
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div className={`flex flex-col h-full ${
          showDuplicates ? 'overflow-hidden' :
          showPanel && panelSection === 'bio' ? 'overflow-hidden' :
          showPanel ? `overflow-y-auto ${SCROLLBAR}` : 'overflow-hidden'
        }`}>

          {showDuplicates ? (
            <div className={`h-full overflow-y-auto ${SCROLLBAR} p-5 flex flex-col gap-4`}>
              {/* Header */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setShowDuplicates(false); setDupePairs([]); setDismissedPairs(new Set()); }}
                  className="text-[10px] px-2 py-1 rounded border border-white/10 text-stone-400 hover:text-white hover:border-white/25 transition-colors shrink-0">
                  ← Back
                </button>
                <h2 className="text-sm font-semibold text-white">Potential Duplicates</h2>
                {!dupeLoading && (
                  <span className="text-xs text-stone-500">
                    {dupePairs.length} pair{dupePairs.length !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>

              {dupeLoading && <p className="text-stone-500 text-xs italic py-4 text-center">Scanning for duplicates…</p>}

              {!dupeLoading && dupePairs.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-stone-400 text-sm">✓ No duplicates found</p>
                  <p className="text-stone-600 text-xs">No exact name overlaps or shared-song links detected.</p>
                </div>
              )}

              {dupePairs.map(pair => {
                const key = [pair.artist_a.id, pair.artist_b.id].sort().join('|');
                const isExpanded = expandedPairs.has(key);
                const fullA = artists.find(a => a.id === pair.artist_a.id);
                const fullB = artists.find(a => a.id === pair.artist_b.id);

                // Helper: dim a row when both values are identical
                const same = (va: string | null | undefined, vb: string | null | undefined) =>
                  (va ?? '') === (vb ?? '');

                return (
                  <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 shrink-0">
                    {/* Confidence chip + shared label + expand toggle */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${
                        pair.confidence === 'high'
                          ? 'bg-red-900/40 border-red-700/40 text-red-400'
                          : 'bg-amber-900/40 border-amber-700/40 text-amber-400'
                      }`}>
                        {pair.confidence === 'high' ? '⚠ Name overlap' : '~ Shared song'}
                      </span>
                      {pair.confidence === 'high' && pair.shared_names.slice(0, 3).map(n => (
                        <span key={n} className="text-[9px] text-stone-500">&ldquo;{n}&rdquo;</span>
                      ))}
                      {pair.confidence === 'medium' && pair.shared_songs.slice(0, 1).map(s => (
                        <span key={s.id} className="text-[9px] text-stone-500 truncate max-w-xs">{s.title}</span>
                      ))}
                      <button
                        onClick={() => setExpandedPairs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                        className="ml-auto text-[9px] text-stone-500 hover:text-stone-300 transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? '▴ hide' : '▾ details'}
                      </button>
                    </div>

                    {/* Side-by-side mini cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {([pair.artist_a, pair.artist_b] as DupeMini[]).map((artist, idx) => {
                        const isKeep = artist.id === pair.suggested_keep;
                        const otherId = idx === 0 ? pair.artist_b.id : pair.artist_a.id;
                        return (
                          <div key={artist.id} className={`flex flex-col gap-2 p-3 rounded-lg border ${
                            isKeep ? 'bg-emerald-900/20 border-emerald-700/30' : 'bg-white/3 border-white/10'
                          }`}>
                            <div className="flex items-start gap-2">
                              <AvatarCircle artist={artist} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-white text-xs font-semibold truncate flex-1">{artist.name_display}</p>
                                  {isKeep && <span className="text-[8px] text-emerald-400 shrink-0">★ keep</span>}
                                </div>
                                {(artist.names_zh[0] ?? artist.names_en[0]) && (
                                  <p className="text-stone-500 text-[10px] truncate">
                                    {[artist.names_zh[0], artist.names_en[0]].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                                <p className="text-stone-600 text-[10px]">
                                  {[artist.ethnic_groups[0], artist.language].filter(Boolean).join(' · ') || '—'}
                                  {' · '}{artist.song_count} song{artist.song_count !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => void mergePair(artist.id, otherId)}
                              className="w-full text-[9px] py-1 px-2 rounded border border-emerald-700/30 text-emerald-400 hover:bg-emerald-900/30 transition-colors text-center"
                            >
                              Keep this →
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expanded detail comparison */}
                    {isExpanded && fullA && fullB && (() => {
                      const rows: { label: string; a: string | null; b: string | null }[] = [
                        { label: 'Names ZH',     a: fullA.names_zh.join(', ') || null,      b: fullB.names_zh.join(', ') || null },
                        { label: 'Names EN',     a: fullA.names_en.join(', ') || null,      b: fullB.names_en.join(', ') || null },
                        { label: 'Names AB',     a: fullA.names_ab.join(', ') || null,      b: fullB.names_ab.join(', ') || null },
                        { label: 'Groups',       a: fullA.ethnic_groups.join(', ') || null, b: fullB.ethnic_groups.join(', ') || null },
                        { label: 'Language',     a: fullA.language,                         b: fullB.language },
                        { label: 'Active years', a: fullA.active_years,                     b: fullB.active_years },
                        { label: 'YouTube',      a: fullA.youtube_channel,                  b: fullB.youtube_channel },
                        { label: 'Wikipedia',    a: fullA.wikipedia_url,                    b: fullB.wikipedia_url },
                        { label: 'Bio EN',       a: fullA.bio_en ? fullA.bio_en.slice(0, 220) + (fullA.bio_en.length > 220 ? '…' : '') : null,
                                                 b: fullB.bio_en ? fullB.bio_en.slice(0, 220) + (fullB.bio_en.length > 220 ? '…' : '') : null },
                        { label: 'Bio ZH',       a: fullA.bio_zh ? fullA.bio_zh.slice(0, 120) + (fullA.bio_zh.length > 120 ? '…' : '') : null,
                                                 b: fullB.bio_zh ? fullB.bio_zh.slice(0, 120) + (fullB.bio_zh.length > 120 ? '…' : '') : null },
                        { label: 'Missing',
                          a: fullA.missing.filter(m => m !== 'no_linked_songs').map(m => MISSING_LABELS[m] ?? m).join(', ') || null,
                          b: fullB.missing.filter(m => m !== 'no_linked_songs').map(m => MISSING_LABELS[m] ?? m).join(', ') || null },
                      ];
                      const isUrl = (v: string | null) => v?.startsWith('http');
                      return (
                        <div className="border-t border-white/8 pt-3 flex flex-col gap-0.5">
                          {rows.map(row => {
                            const identical = same(row.a, row.b);
                            const baseText = identical ? 'text-stone-600' : 'text-stone-300';
                            const nullText = 'text-stone-700 italic';
                            return (
                              <div key={row.label} className={`grid grid-cols-[64px_1fr_1fr] gap-2 text-[10px] py-0.5 rounded px-1 ${identical ? '' : 'bg-white/3'}`}>
                                <span className="text-stone-600 font-medium pt-0.5 shrink-0">{row.label}</span>
                                {[row.a, row.b].map((val, i) => (
                                  <span key={i} className={val ? baseText : nullText}>
                                    {val
                                      ? isUrl(val)
                                        ? <a href={val} target="_blank" rel="noreferrer" className="underline hover:text-white">{val.replace(/^https?:\/\//, '').slice(0, 40)}</a>
                                        : val
                                      : '—'
                                    }
                                  </span>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Dismiss */}
                    <button
                      onClick={() => dismissPair(pair.artist_a.id, pair.artist_b.id)}
                      className="text-[9px] text-stone-600 hover:text-stone-400 transition-colors text-center w-full"
                    >
                      ✕ Not a duplicate — dismiss
                    </button>
                  </div>
                );
              })}
            </div>
          ) : showPanel && draft ? (
            <div className={`p-5 flex flex-col gap-4 ${panelSection === 'bio' ? 'h-full' : ''}`}>

              {/* Header card */}
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 border border-white/10 min-w-0">
                  {selected && (
                    <button
                      onClick={deselect}
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white/10 hover:bg-white/20 text-stone-400 hover:text-white transition-colors text-[10px] leading-none"
                      title="Back to new artist"
                    >
                      ✕
                    </button>
                  )}
                  {selected && !isNew && <AvatarCircle artist={selected} />}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-white text-sm font-bold truncate leading-tight flex-1 min-w-0">
                        {(splitCSV(draft.names_ab)[0] ?? splitCSV(draft.names_en)[0] ?? splitCSV(draft.names_zh)[0]) || (isNew ? 'Add Artist' : '—')}
                      </p>
                      {selected && !isNew && selected.missing.length > 0 && (
                        <div className="flex gap-0.5 items-center shrink-0">
                          {selected.missing.slice(0, 1).map(m => <MissingBadge key={m} label={m} />)}
                          {selected.missing.length > 1 && <span className="text-[9px] text-stone-600">+{selected.missing.length - 1}</span>}
                        </div>
                      )}
                    </div>
                    {isNew ? (
                      <input
                        autoFocus
                        type="text"
                        value={newArtistName}
                        onChange={e => setNewArtistName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && newArtistName.trim()) void researchArtist(newArtistName.trim()); }}
                        placeholder="Artist name to research…"
                        className="w-full text-xs text-stone-300 bg-transparent border-b border-white/15 focus:outline-none focus:border-white/40 placeholder-stone-600 py-0.5 transition-colors"
                      />
                    ) : (
                      <p className="text-stone-400 text-xs truncate leading-tight">
                        {[
                          selected?.ethnic_groups.join(', '),
                          selected?.language,
                          selected?.is_group ? 'group' : null,
                          `${selected?.song_count ?? 0} song${(selected?.song_count ?? 0) !== 1 ? 's' : ''}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {!isNew && (draft.youtube_channel || draft.wikipedia_url || draft.website_url) && (
                      <div className="flex gap-1 mt-0.5">
                        {draft.youtube_channel && (
                          <a href={draft.youtube_channel} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-stone-500 hover:text-red-400 hover:border-red-500/30 transition-colors">
                            YT
                          </a>
                        )}
                        {draft.wikipedia_url && (
                          <a href={draft.wikipedia_url} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-stone-500 hover:text-blue-400 hover:border-blue-500/30 transition-colors">
                            WP
                          </a>
                        )}
                        {draft.website_url && (
                          <a href={draft.website_url} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-stone-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors">
                            Web
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata / Bio stacked toggles */}
                <div className="flex flex-col gap-2 shrink-0 w-20">
                  <button
                    onClick={() => setPanelSection('metadata')}
                    className={`flex-1 flex items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors ${
                      panelSection === 'metadata'
                        ? 'bg-stone-500/30 border-stone-400/30 text-stone-200'
                        : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                    }`}
                  >
                    Metadata
                  </button>
                  <button
                    onClick={() => setPanelSection('bio')}
                    className={`flex-1 flex items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors ${
                      panelSection === 'bio'
                        ? 'bg-stone-500/30 border-stone-400/30 text-stone-200'
                        : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                    }`}
                  >
                    Bio
                  </button>
                </div>

                {/* Research button */}
                <div className="shrink-0 aspect-square flex">
                  {panelStatus === 'researching' ? (
                    <button
                      onClick={() => { setPanelStatus('idle'); setPanelMessage(''); }}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[10px] font-semibold transition-colors">
                      <span>✕</span><span>Stop</span>
                    </button>
                  ) : artistResearched ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-semibold">
                      <span className="text-sm">✓</span>
                      <span className="text-[9px]">Done</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const name = isNew
                          ? newArtistName.trim()
                          : (splitCSV(draft.names_en)[0] ?? splitCSV(draft.names_zh)[0] ?? splitCSV(draft.names_ab)[0] ?? '');
                        if (name) void researchArtist(name);
                      }}
                      disabled={isNew ? !newArtistName.trim() : (!draft.names_en && !draft.names_zh && !draft.names_ab)}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                      <span className="text-sm">✦</span>
                      <span>AI</span>
                    </button>
                  )}
                </div>

                {/* Save button */}
                <div className="shrink-0 aspect-square flex">
                  <button
                    onClick={() => void saveArtist()}
                    disabled={panelStatus === 'saving' || panelStatus === 'researching' || (!draft.names_en && !draft.names_zh && !draft.names_ab)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                    <span className="text-sm">{panelStatus === 'saving' ? '…' : '✓'}</span>
                    <span>{panelStatus === 'saving' ? 'Saving' : 'Save'}</span>
                  </button>
                </div>
              </div>


              {/* Panel message */}
              {panelMessage && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  panelStatus === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : panelStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-300'}`}>
                  {panelMessage}
                </div>
              )}

              {/* Notes — always visible above sub-tabs */}
              <Field label="Notes (internal)" value={draft.notes} onChange={v => setField('notes', v)} multiline />

              {/* Fields to resolve — above both tabs; no_linked_songs excluded (not researchable) */}
              {selected && !isNew && (() => {
                const activeMissing = selected.missing
                  .filter(m => m !== 'no_linked_songs')
                  .filter(m => !draft.researched_fields.includes(m));
                const naFields = naFilter ? draft.researched_fields.filter(m => m !== 'no_linked_songs') : [];
                if (activeMissing.length === 0 && naFields.length === 0) return null;
                return (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Fields to resolve</label>
                      {activeMissing.length > 0 && (
                        <button
                          onClick={() => void naAll(activeMissing)}
                          className="text-[9px] px-1.5 py-0.5 rounded border border-orange-700/30 text-orange-500 hover:bg-orange-900/30 transition-colors">
                          N/A all
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeMissing.map(m => (
                        <button key={m} onClick={() => void toggleNA(m)}
                          title="Mark as researched — nothing found (N/A)"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border bg-orange-900/40 text-orange-400 border-orange-700/40 hover:bg-stone-800 hover:text-stone-400 hover:border-stone-600/50 transition-colors group">
                          {MISSING_LABELS[m] ?? m}
                          <span className="opacity-40 group-hover:opacity-70 text-[8px]">→ N/A</span>
                        </button>
                      ))}
                      {naFields.map(m => (
                        <button key={m} onClick={() => void toggleNA(m)}
                          title="Undo N/A — mark as still missing"
                          className="px-1.5 py-0.5 rounded text-[9px] border bg-stone-800/40 text-stone-600 border-stone-700/30 hover:text-stone-400 hover:border-stone-500/40 transition-colors line-through decoration-stone-600">
                          {MISSING_LABELS[m] ?? m}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Metadata tab ──────────────────────────────────────────────── */}
              {panelSection === 'metadata' && (
                <div className="flex flex-col gap-4">

                  {/* Linked Songs */}
                  {selected && !isNew && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Linked Songs ({allSongs ? linkedSongs.length : (selected.song_count ?? 0)})
                        </h3>
                        <button
                          onClick={() => { void loadSongs(); setSongPickerOpen(p => !p); setSongQuery(''); }}
                          className="text-[9px] px-1.5 py-0.5 rounded text-stone-600 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30 transition-colors"
                          title="Link a song"
                        >
                          + add
                        </button>
                        <button
                          onClick={() => void rescanSongs()}
                          className="text-[9px] px-1.5 py-0.5 rounded text-stone-600 hover:text-violet-400 border border-transparent hover:border-violet-500/30 transition-colors ml-auto"
                          title="Re-scan all songs for name matches"
                        >
                          ↺ re-scan
                        </button>
                      </div>
                      {allSongs ? (
                        <div className="flex flex-wrap gap-1.5">
                          {linkedSongs.length === 0 && (
                            <p className="text-stone-600 text-xs italic">No songs linked yet.</p>
                          )}
                          {linkedSongs.map(song => (
                            <div key={song.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-xs text-stone-300">
                              <span className="truncate max-w-48">{song.title_original ?? song.yt_title ?? song.title}</span>
                              <button
                                onClick={() => void unlinkSong(song.id)}
                                className="text-stone-500 hover:text-red-400 transition-colors text-[10px] shrink-0"
                                title="Unlink"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : loadingSongs ? (
                        <p className="text-stone-600 text-xs italic">Loading…</p>
                      ) : null}
                      {songPickerOpen && (
                        <div className="relative">
                          <input
                            autoFocus
                            type="text"
                            value={songQuery}
                            onChange={e => setSongQuery(e.target.value)}
                            onBlur={() => setTimeout(() => { setSongPickerOpen(false); setSongQuery(''); }, 150)}
                            placeholder={loadingSongs ? 'Loading…' : 'Search songs to link…'}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                          />
                          {songPickerResults.length > 0 && (
                            <div className={`absolute top-full left-0 right-0 z-50 mt-1 bg-stone-900 border border-white/15 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto ${SCROLLBAR}`}>
                              {songPickerResults.map(song => (
                                <button
                                  key={song.id}
                                  onMouseDown={() => void linkSong(song.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                  <p className="font-medium truncate">{song.title_original ?? song.yt_title ?? song.title}</p>
                                  <p className="text-stone-500 text-[10px] truncate">{song.artist_credit}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ethnic groups */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Ethnic Groups</label>
                    <div className="grid grid-cols-8 gap-1.5 bg-white/5 border border-white/10 rounded-lg p-2">
                      {ETHNIC_GROUPS.map(g => {
                        const checked = draft.ethnic_groups.includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setField('ethnic_groups', checked
                              ? draft.ethnic_groups.filter(x => x !== g)
                              : [...draft.ethnic_groups, g]
                            )}
                            className={`w-full text-center px-1 py-0.5 rounded text-[10px] transition-colors border ${
                              checked ? 'bg-violet-500/30 border-violet-500/40 text-violet-200' : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/10 hover:text-stone-300'
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 items-start">
                    {/* Left: 3 name fields + language + group toggle */}
                    <div className="flex flex-col gap-4">
                      <Field label="Indigenous names (first = primary)" value={draft.names_ab} onChange={v => setField('names_ab', v)} placeholder="name in the indigenous language" />
                      <Field label="Chinese names (first = primary)"    value={draft.names_zh} onChange={v => setField('names_zh', v)} placeholder="e.g. 巴奈, 巴奈·庫穗" />
                      <Field label="English names (first = primary)"    value={draft.names_en} onChange={v => setField('names_en', v)} placeholder="e.g. Baai, Panai Kusui" />
                      <Field label="Active Years"                       value={draft.active_years} onChange={v => setField('active_years', v)} placeholder="e.g. 2000s–present" />
                      <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <SelectField label="Language" value={draft.language} onChange={v => setField('language', v)} options={LANGUAGES} />
                        </div>
                        <button
                          type="button"
                          onClick={() => setField('is_group', !draft.is_group)}
                          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                            draft.is_group ? 'bg-sky-500/20 border-sky-500/30 text-sky-300' : 'bg-white/5 border-white/10 text-stone-400 hover:bg-white/8'
                          }`}
                        >
                          <div className={`relative w-6 h-3 rounded-full transition-colors shrink-0 ${draft.is_group ? 'bg-sky-500' : 'bg-white/15'}`}>
                            <span className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white shadow transition-transform duration-200 ${draft.is_group ? 'translate-x-3' : ''}`} />
                          </div>
                          {draft.is_group ? 'Group' : 'Solo'}
                        </button>
                      </div>
                    </div>
                    {/* Right: links + sources */}
                    <div className="flex flex-col gap-4">
                      <Field label="Wikipedia URL"            value={draft.wikipedia_url}   onChange={v => setField('wikipedia_url', v)}   placeholder="https://zh.wikipedia.org/…" />
                      <Field label="YouTube Channel"          value={draft.youtube_channel} onChange={v => setField('youtube_channel', v)} placeholder="https://youtube.com/…" />
                      <Field label="Website"                  value={draft.website_url}     onChange={v => setField('website_url', v)}     placeholder="https://…" />
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <Field label="Photo URL" value={draft.photo_url} onChange={v => setField('photo_url', v)} placeholder="https://…" />
                        </div>
                        {isValidImageUrl(draft.photo_url) && (
                          <div className="shrink-0 mt-5 flex items-center gap-1">
                            {photoCheck === 'checking' && <span className="text-[10px] text-stone-500">…</span>}
                            {photoCheck === 'ok'       && <span className="text-[10px] text-emerald-400">✓</span>}
                            {photoCheck === 'bad'      && <span className="text-[10px] text-amber-400" title="Image URL returned an error">⚠</span>}
                            <a href={draft.photo_url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-stone-500 hover:text-stone-300 hover:border-white/25 transition-colors">
                              ↗
                            </a>
                          </div>
                        )}
                      </div>
                      <Field label="Sources (comma-sep URLs)" value={draft.sources}         onChange={v => setField('sources', v)}         placeholder="https://wikipedia.org/…" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Bio tab ───────────────────────────────────────────────────── */}
              {panelSection === 'bio' && (
                <div className="flex-1 min-h-0 flex flex-col gap-3">

                  {/* Member management (groups only) — shrink-0, above bios */}
                  {draft.is_group && selected && !isNew && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Members</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.member_ids ?? []).length === 0 && (
                          <p className="text-stone-600 text-xs italic">No members linked yet.</p>
                        )}
                        {(selected.member_ids ?? []).map(memberId => {
                          const member = artists.find(a => a.id === memberId);
                          return (
                            <div key={memberId} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-xs text-stone-300">
                              <span>{member?.name_display ?? memberId}</span>
                              <button onClick={() => removeMember(memberId)} className="text-stone-500 hover:text-red-400 transition-colors text-[10px]">✕</button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="relative">
                        <input
                          ref={memberInputRef}
                          type="text"
                          value={memberQuery}
                          onChange={e => { setMemberQuery(e.target.value); setMemberDropdown(true); }}
                          onFocus={() => setMemberDropdown(true)}
                          onBlur={() => setTimeout(() => setMemberDropdown(false), 150)}
                          placeholder="Search artist to add as member…"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                        />
                        {memberDropdown && memberSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-stone-900 border border-white/15 rounded-lg overflow-hidden shadow-xl">
                            {memberSuggestions.map(a => (
                              <button
                                key={a.id}
                                onMouseDown={() => addMember(a.id)}
                                className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                              >
                                <AvatarCircle artist={a} />
                                <div>
                                  <p className="font-medium">{a.name_display}</p>
                                  <p className="text-stone-500 text-[10px]">{a.ethnic_groups[0] ?? ''} {a.language ?? ''}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3-col bio fields — fill remaining space */}
                  <div className="flex-1 min-h-0 grid grid-cols-3 gap-3 *:h-full">
                    <Field label="Bio (ZH)"  value={draft.bio_zh}  onChange={v => setField('bio_zh', v)}  multiline fill placeholder="Short Chinese biography" />
                    <Field label="Bio (EN)"  value={draft.bio_en}  onChange={v => setField('bio_en', v)}  multiline fill placeholder="Short English biography" />
                    <Field label="Bio (YCM)" value={draft.bio_ycm} onChange={v => setField('bio_ycm', v)} multiline fill placeholder="Internal curation notes" />
                  </div>

                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
