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
  sources: string[];
  notes: string | null;
  photo_url: string | null;
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
  photo_url: string;
  sources: string;
  notes: string;
};

type UnlinkedItem = { song_artist_string: string; song_title: string; yt_url: string; suggested_action: string };

function draftFromArtist(a: ArtistRow): ArtistDraft {
  return {
    names_zh:        a.names_zh.join(', '),
    names_en:        a.names_en.join(', '),
    names_ab:        a.names_ab.join(', '),
    ethnic_groups:   [...a.ethnic_groups],
    language:        a.language        ?? '',
    is_group:        a.is_group,
    active_years:    a.active_years    ?? '',
    bio_zh:          a.bio_zh          ?? '',
    bio_en:          a.bio_en          ?? '',
    bio_ycm:         a.bio_ycm         ?? '',
    youtube_channel: a.youtube_channel ?? '',
    wikipedia_url:   a.wikipedia_url   ?? '',
    photo_url:       a.photo_url       ?? '',
    sources:         a.sources.join(', '),
    notes:           a.notes           ?? '',
  };
}

const BLANK_DRAFT: ArtistDraft = {
  names_zh: '', names_en: '', names_ab: '',
  ethnic_groups: [], language: '', is_group: false,
  active_years: '', bio_zh: '', bio_en: '', bio_ycm: '',
  youtube_channel: '', wikipedia_url: '', photo_url: '', sources: '', notes: '',
};

function splitCSV(s: string): string[] {
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

const CJK = /[一-鿿㐀-䶿]/;

// Parse a single artist token like "王宏恩 (Biung Wang)" into name fields.
// Outer CJK → names_zh; parenthetical → names_en. Plain romanized → names_en only.
function parseCreditToken(token: string): { names_zh: string; names_en: string; names_ab: string } {
  const m = token.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (m) {
    const outer = m[1].trim(), inner = m[2].trim();
    return CJK.test(outer)
      ? { names_zh: outer, names_en: inner, names_ab: '' }
      : { names_zh: '', names_en: outer, names_ab: inner };
  }
  return CJK.test(token)
    ? { names_zh: token, names_en: '', names_ab: '' }
    : { names_zh: '', names_en: token, names_ab: '' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, multiline = false, placeholder }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}>) {
  const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors resize-none';
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
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
  const [isNew, setIsNew]               = useState(false);
  const [draft, setDraft]               = useState<ArtistDraft | null>(null);
  const [panelStatus, setPanelStatus]   = useState<'idle' | 'researching' | 'saving' | 'saved' | 'error'>('idle');
  const [panelMessage, setPanelMessage] = useState('');
  const [artistResearched, setArtistResearched] = useState(false);

  const [unlinked, setUnlinked]         = useState<UnlinkedItem[]>([]);
  const [unlinkedOpen, setUnlinkedOpen] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const abortRef                        = useRef(false);

  // Member management
  const [memberQuery, setMemberQuery]   = useState('');
  const [memberDropdown, setMemberDropdown] = useState(false);
  const memberInputRef                  = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof ArtistDraft>(key: K, value: ArtistDraft[K]) =>
    setDraft(d => d ? { ...d, [key]: value } : d);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  async function fetchArtists() {
    setLoading(true);
    try {
      const [artistRes, unlinkedRes] = await Promise.all([
        fetch('/api/admin/all-artists'),
        fetch('/api/admin/unlinked-artists'),
      ]);
      const artistData = await artistRes.json();
      const unlinkedData = await unlinkedRes.json();
      if (Array.isArray(artistData)) setArtists(artistData);
      if (Array.isArray(unlinkedData)) setUnlinked(unlinkedData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchArtists(); }, []);

  // ── Selection ────────────────────────────────────────────────────────────────

  function deselect() {
    setSelected(null); setIsNew(false); setDraft(null);
    setPanelStatus('idle'); setPanelMessage('');
    setArtistResearched(false); setMemberQuery('');
  }

  function handleArtistClick(artist: ArtistRow) {
    if (!isNew && selected?.id === artist.id) { deselect(); return; }
    setSelected(artist); setIsNew(false);
    setDraft(draftFromArtist(artist));
    setPanelStatus('idle'); setPanelMessage('');
    setArtistResearched(false); setMemberQuery('');
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

  function handleAddNew() {
    setSelected(null); setIsNew(true);
    setDraft({ ...BLANK_DRAFT });
    setPanelStatus('idle'); setPanelMessage('');
    setArtistResearched(false);
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
      const aiLabel = `[AI — ${new Date().toISOString().slice(0, 10)}]`;
      const tagBio = (existing: string, ai: string) =>
        ai ? `${ai}\n\n${aiLabel}` : existing;
      setDraft(d => d ? {
        ...d,
        names_zh:        Array.isArray(r.names_zh) ? r.names_zh.join(', ') : d.names_zh,
        names_en:        Array.isArray(r.names_en) ? r.names_en.join(', ') : d.names_en,
        names_ab:        Array.isArray(r.names_ab) ? r.names_ab.join(', ') : d.names_ab,
        ethnic_groups:   Array.isArray(r.ethnic_groups) ? r.ethnic_groups : d.ethnic_groups,
        language:        r.language        || d.language,
        is_group:        r.is_group        ?? d.is_group,
        active_years:    r.active_years    || d.active_years,
        bio_zh:          tagBio(d.bio_zh, r.bio_zh),
        bio_en:          tagBio(d.bio_en, r.bio_en),
        youtube_channel: r.youtube_channel || d.youtube_channel,
        wikipedia_url:   r.wikipedia_url   || d.wikipedia_url,
        photo_url:       r.photo_url       || d.photo_url,
        sources:         [
          ...splitCSV(d.sources),
          ...(Array.isArray(r.sources) ? r.sources : []),
          ...groundingSources,
        ].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', '),
        notes:           r.notes           || d.notes,
      } : d);
      setArtistResearched(true);
      setPanelStatus('idle');
      setPanelMessage('✓ Research complete — review and save.');
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Research failed');
    }
  }

  // ── Batch research (unlinked) ────────────────────────────────────────────────

  async function handleBatchResearch() {
    const candidates = unlinked.filter(i => i.song_artist_string !== 'Unknown / Traditional');
    if (!candidates.length) return;
    abortRef.current = false;
    setBatchRunning(true);
    for (const item of candidates) {
      if (abortRef.current) break;
      try {
        const res = await fetch('/api/admin/research-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: item.song_artist_string, yt_url: item.yt_url, song_title: item.song_title }),
        });
        const data = await res.json();
        if (!res.ok || !data.research) continue;
        await fetch('/api/admin/save-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.research),
        });
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 400));
    }
    setBatchRunning(false);
    fetchArtists();
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
        photo_url:       draft.photo_url       || null,
        sources:         splitCSV(draft.sources),
        notes:           draft.notes           || null,
      };

      if (isNew) {
        const res = await fetch('/api/admin/save-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Save failed');
        const saved = json.saved as { id: string; name_display: string };
        setPanelStatus('saved');
        setPanelMessage(`✓ Created "${saved.name_display}"`);
      } else if (selected) {
        const res = await fetch('/api/admin/update-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_id: selected.id, fields: payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Save failed');
        setPanelStatus('saved');
        setPanelMessage('✓ Saved.');
      }
      fetchArtists();
    } catch (err) {
      setPanelStatus('error');
      setPanelMessage(err instanceof Error ? err.message : 'Save failed');
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

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filtered = artists.filter(a => {
    if (filterType === 'individual' && a.is_group) return false;
    if (filterType === 'groups' && !a.is_group) return false;
    if (filters?.ethnic_group && !a.ethnic_groups.includes(filters.ethnic_group)) return false;
    const fm = filters?.artist_missing_field ?? '';
    if (fm === 'any' && a.missing.length === 0) return false;
    if (fm && fm !== 'any' && !a.missing.includes(fm)) return false;
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

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasDraft = !!draft;
  const showPanel = hasDraft;

  return (
    <div className="bg-[#0f0f16] rounded-xl border border-white/10 overflow-hidden flex flex-col h-full min-h-[520px]">
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
                {/* Row 1: Search + Add */}
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search artists…"
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <button onClick={handleAddNew}
                    className="text-[10px] px-2 py-1.5 rounded border bg-white/5 border-white/10 text-stone-300 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0">
                    + Add
                  </button>
                </div>
                {/* Row 2: Filters + actions */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg overflow-hidden border border-white/10 text-[10px] shrink-0">
                    {(['all', 'individual', 'groups'] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t)}
                        className={`px-2 py-1 transition-colors ${filterType === t ? 'bg-white/15 text-white' : 'bg-white/3 text-stone-500 hover:bg-white/8'}`}>
                        {t === 'all' ? 'All' : t === 'individual' ? 'Solo' : 'Groups'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <button onClick={handleAutoLink}
                      className="text-[10px] px-2 py-1 rounded border bg-white/5 border-white/10 text-stone-300 hover:bg-white/10 transition-colors whitespace-nowrap">
                      ⚡ Auto-link
                    </button>
                    {unlinked.length > 0 && (
                      batchRunning ? (
                        <button onClick={() => { abortRef.current = true; setBatchRunning(false); }}
                          className="text-[10px] px-2 py-1 rounded border bg-red-500/20 border-red-500/30 text-red-400 whitespace-nowrap">
                          ✕ Stop
                        </button>
                      ) : (
                        <button onClick={handleBatchResearch}
                          className="text-[10px] px-2 py-1 rounded border bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors whitespace-nowrap">
                          ✦ {unlinked.filter(i => i.song_artist_string !== 'Unknown / Traditional').length}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Unlinked queue */}
              {unlinked.length > 0 && (
                <div className="border-b border-white/5 shrink-0">
                  <button
                    onClick={() => setUnlinkedOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] text-stone-400 hover:text-stone-200 transition-colors"
                  >
                    <span className="font-bold uppercase tracking-widest">Unlinked ({unlinked.length})</span>
                    <span>{unlinkedOpen ? '▲' : '▼'}</span>
                  </button>
                  {unlinkedOpen && (
                    <div className={`max-h-36 overflow-y-auto divide-y divide-white/5 ${SCROLLBAR}`}>
                      {unlinked.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/3 transition-colors">
                          <button
                            onClick={() => {
                              const stub: ArtistRow = {
                                id: '', name_display: item.song_artist_string, names_zh: [], names_en: [], names_ab: [],
                                zh_surname: null, ethnic_groups: [], language: null, is_group: false, active_years: null,
                                bio_zh: null, bio_en: null, bio_ycm: null, youtube_channel: null, wikipedia_url: null,
                                sources: [], notes: null, photo_url: null, group_ids: [], member_ids: [],
                                song_count: 0, missing: [],
                              };
                              setSelected(stub); setIsNew(true);
                              setDraft({ ...BLANK_DRAFT, ...parseCreditToken(item.song_artist_string.split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)[0].trim()) });
                              setPanelStatus('idle'); setPanelMessage('');
                            }}
                            className="flex-1 min-w-0 pr-2 text-left"
                          >
                            <p className="text-white text-xs font-medium truncate">{item.song_artist_string}</p>
                            <p className="text-stone-600 text-[9px] truncate">{item.song_title}</p>
                          </button>
                          <button
                            onClick={() => {
                              const stub: ArtistRow = {
                                id: '', name_display: item.song_artist_string, names_zh: [], names_en: [], names_ab: [],
                                zh_surname: null, ethnic_groups: [], language: null, is_group: false, active_years: null,
                                bio_zh: null, bio_en: null, bio_ycm: null, youtube_channel: null, wikipedia_url: null,
                                sources: [], notes: null, photo_url: null, group_ids: [], member_ids: [],
                                song_count: 0, missing: [],
                              };
                              setSelected(stub); setIsNew(true);
                              setDraft({ ...BLANK_DRAFT, ...parseCreditToken(item.song_artist_string.split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)[0].trim()) });
                              setPanelStatus('idle'); setPanelMessage('');
                              researchArtist(item.song_artist_string, item.yt_url, item.song_title);
                            }}
                            className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[9px] font-bold transition-colors"
                          >
                            ✦
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Artist list */}
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
                      {artist.missing.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap justify-end shrink-0 max-w-24">
                          {artist.missing.slice(0, 2).map(m => <MissingBadge key={m} label={m} />)}
                          {artist.missing.length > 2 && <span className="text-[8px] text-stone-600 self-center">+{artist.missing.length - 2}</span>}
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => { handleArtistClick(artist); researchArtist(artist.name_display); }}
                      title="Research with AI"
                      className="shrink-0 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors"
                    >
                      ✦
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteArtist(artist); }}
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
            </>
          )}
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <div className={`flex flex-col ${showPanel ? `overflow-y-auto ${SCROLLBAR}` : 'overflow-hidden'}`}>

          {!showPanel && (
            <div className="flex-1 flex items-center justify-center text-stone-600 text-xs italic p-8 text-center">
              Select an artist to edit, or click + Add Artist
            </div>
          )}

          {showPanel && draft && (
            <div className="p-5 flex flex-col gap-4">

              {/* Header card */}
              <div className="flex items-stretch gap-2">
                <div className="flex-1 flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/10 min-w-0">
                  {selected && !isNew && <AvatarCircle artist={selected} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-white text-base font-bold leading-tight">
                        {(splitCSV(draft.names_ab)[0] ?? splitCSV(draft.names_en)[0] ?? splitCSV(draft.names_zh)[0]) || (isNew ? 'New Artist' : '—')}
                      </p>
                      {selected && !isNew && selected.missing.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-0.5">
                          {selected.missing.map(m => <MissingBadge key={m} label={m} />)}
                        </div>
                      )}
                    </div>
                    {selected && !isNew && (
                      <p className="text-stone-400 text-xs mt-0.5">
                        {[selected.ethnic_groups.join(', '), selected.language].filter(Boolean).join(' · ')}
                        {selected.is_group && <span className="ml-1 text-sky-400 text-[10px]">group</span>}
                      </p>
                    )}
                    {isNew && <p className="text-stone-600 text-xs mt-0.5 italic">New artist record</p>}
                  </div>
                  <button onClick={deselect} className="text-stone-500 hover:text-white transition-colors text-xs shrink-0" title="Close">✕</button>
                </div>

                {/* Research button */}
                <div className="shrink-0 flex w-20">
                  {panelStatus === 'researching' ? (
                    <button
                      onClick={() => { setPanelStatus('idle'); setPanelMessage(''); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[10px] font-semibold transition-colors">
                      <span>✕</span><span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => researchArtist(splitCSV(draft.names_en)[0] ?? splitCSV(draft.names_zh)[0] ?? splitCSV(draft.names_ab)[0] ?? '')}
                      disabled={(!draft.names_en && !draft.names_zh && !draft.names_ab) || artistResearched}
                      className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                      <span className="text-sm">✦</span>
                      <span className="leading-tight text-center whitespace-pre-line">
                        {artistResearched ? '✓ Done' : 'Research\nwith AI'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Save button */}
                <div className="shrink-0 flex w-20">
                  <button
                    onClick={() => void saveArtist()}
                    disabled={panelStatus === 'saving' || panelStatus === 'researching' || (!draft.names_en && !draft.names_zh && !draft.names_ab)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold transition-colors disabled:opacity-40">
                    <span className="text-sm">{panelStatus === 'saving' ? '…' : '✓'}</span>
                    <span className="leading-tight text-center whitespace-pre-line">
                      {panelStatus === 'saving' ? 'Saving' : 'Save\nChanges'}
                    </span>
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

              {/* ── Ethnic groups — full width ────────────────────────────────── */}
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

              {/* ── Form grid ────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 items-start">

                {/* Left column */}
                <div className="flex flex-col gap-4">
                  <Field label="Indigenous names (first = primary)"  value={draft.names_ab} onChange={v => setField('names_ab', v)} placeholder="comma-sep, e.g. Cjavi names" />
                  <Field label="Chinese names (first = primary)"     value={draft.names_zh} onChange={v => setField('names_zh', v)} placeholder="e.g. 巴奈, 巴奈·庫穗" />
                  <Field label="English names (first = primary)"     value={draft.names_en} onChange={v => setField('names_en', v)} placeholder="e.g. Baai, Panai Kusui" />
                  <Field label="Active Years"             value={draft.active_years}    onChange={v => setField('active_years', v)} placeholder="e.g. 2000s–present" />
                  <Field label="YouTube Channel"          value={draft.youtube_channel} onChange={v => setField('youtube_channel', v)} placeholder="https://youtube.com/…" />
                  <Field label="Wikipedia URL"            value={draft.wikipedia_url}   onChange={v => setField('wikipedia_url', v)} placeholder="https://zh.wikipedia.org/…" />
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <SelectField label="Language" value={draft.language} onChange={v => setField('language', v)} options={LANGUAGES} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setField('is_group', !draft.is_group)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors mb-0 ${
                        draft.is_group ? 'bg-sky-500/20 border-sky-500/30 text-sky-300' : 'bg-white/5 border-white/10 text-stone-400 hover:bg-white/8'
                      }`}
                    >
                      <div className={`relative w-6 h-3 rounded-full transition-colors shrink-0 ${draft.is_group ? 'bg-sky-500' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-white shadow transition-transform duration-200 ${draft.is_group ? 'translate-x-3' : ''}`} />
                      </div>
                      {draft.is_group ? 'Group' : 'Solo'}
                    </button>
                  </div>
                  <Field label="Photo URL"               value={draft.photo_url}       onChange={v => setField('photo_url', v)} placeholder="https://…" />
                  <Field label="Sources (comma-sep URLs)" value={draft.sources}         onChange={v => setField('sources', v)} placeholder="https://wikipedia.org/…" />
                  <Field label="Notes (internal)"        value={draft.notes}           onChange={v => setField('notes', v)} multiline />
                </div>
              </div>

              {/* Full-width bios */}
              <div className="flex flex-col gap-4">
                <Field label="Bio (ZH)"  value={draft.bio_zh}  onChange={v => setField('bio_zh', v)}  multiline placeholder="Short Chinese biography" />
                <Field label="Bio (EN)"  value={draft.bio_en}  onChange={v => setField('bio_en', v)}  multiline placeholder="Short English biography" />
                <Field label="Bio (YCM)" value={draft.bio_ycm} onChange={v => setField('bio_ycm', v)} multiline placeholder="Internal curation notes" />
              </div>

              {/* ── Member management (groups only) ──────────────────────────── */}
              {draft.is_group && selected && !isNew && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Members</h3>
                  {/* Current members */}
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
                  {/* Add member */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
