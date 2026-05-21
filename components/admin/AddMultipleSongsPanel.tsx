'use client';
import { useState } from 'react';

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

type InputMode = 'url' | 'name';

type ItemStatus = 'pending' | 'fetching' | 'fetched' | 'researching' | 'saving' | 'saved' | 'error' | 'duplicate';

type QueueItem = {
  videoId: string;
  url: string;
  status: ItemStatus;
  title?: string;
  channel?: string;
  draft?: Record<string, unknown>;
  error?: string;
  checked: boolean;
  enriched: boolean;
  activeSection: 'metadata' | 'lyrics' | null;
};

function extractPlaylistId(text: string): string | null {
  // Only pure playlist pages, not video-with-list URLs
  return text.trim().match(/youtube\.com\/playlist\?(?:[^&\s]*&)*list=([\w-]+)/)?.[1] ?? null;
}

function extractChannelId(text: string): string | null {
  const t = text.trim();
  // @handle — return without the @
  const handle = t.match(/youtube\.com\/@([\w.-]+)(?:[/?#]|$)/)?.[1];
  if (handle) return handle;
  // /channel/UCxxxxxx
  return t.match(/youtube\.com\/channel\/(UC[\w-]+)(?:[/?#]|$)/)?.[1] ?? null;
}

function extractUrls(text: string): string[] {
  const re = /(?:youtube\.com\/(?:watch\?(?:[^&\s"']*&)*v=|shorts\/)|youtu\.be\/)([\w-]{11})/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(`https://www.youtube.com/watch?v=${m[1]}`); }
  }
  return out;
}

function videoIdFromUrl(url: string): string | null {
  return url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  pending:     'bg-stone-700 text-stone-300',
  fetching:    'bg-sky-500/20 text-sky-300 animate-pulse',
  fetched:     'bg-violet-500/20 text-violet-300',
  researching: 'bg-violet-500/30 text-violet-200 animate-pulse',
  saving:      'bg-amber-500/20 text-amber-300 animate-pulse',
  saved:       'bg-emerald-500/20 text-emerald-300',
  error:       'bg-red-500/20 text-red-400',
  duplicate:   'bg-stone-700/50 text-stone-500',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  pending:     'Pending',
  fetching:    'Fetching…',
  fetched:     'Ready',
  researching: 'Researching…',
  saving:      'Saving…',
  saved:       'Saved ✓',
  error:       'Error',
  duplicate:   'In library',
};

const inputCls = 'w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-white/30 transition-colors';

function InlineField({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} className={inputCls} />}
    </div>
  );
}

function InlineSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-bold uppercase tracking-widest text-stone-500">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30 transition-colors">
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function AddMultipleSongsPanel() {
  const [mode, setMode]   = useState<InputMode>('url');
  const [text, setText]   = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [autoExtract, setAutoExtract] = useState(true);

  const updateItem = (videoId: string, patch: Partial<QueueItem>) =>
    setQueue(q => q.map(item => item.videoId === videoId ? { ...item, ...patch } : item));

  const updateDraftField = (videoId: string, key: string, value: unknown) =>
    setQueue(q => q.map(item =>
      item.videoId === videoId
        ? { ...item, draft: { ...(item.draft ?? {}), [key]: value } }
        : item
    ));

  // ── Duplicate detection ───────────────────────────────────────────────────────

  async function checkForDuplicates(items: QueueItem[]): Promise<Set<string>> {
    const ids = items.map(i => i.videoId).filter(id => /^[\w-]{11}$/.test(id));
    if (!ids.length) return new Set();
    try {
      const res = await fetch('/api/admin/check-duplicate-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: ids }),
      });
      if (!res.ok) return new Set();
      const { duplicates } = await res.json() as { duplicates: string[] };
      return new Set(duplicates);
    } catch {
      return new Set(); // fail open
    }
  }

  function tagDuplicates(items: QueueItem[], dupes: Set<string>): QueueItem[] {
    return items.map(i => dupes.has(i.videoId) ? { ...i, status: 'duplicate' as ItemStatus } : i);
  }

  // ── URL mode ─────────────────────────────────────────────────────────────────

  function buildNewUrlItems(urls: string[]): QueueItem[] {
    const existing = new Set(queue.map(i => i.videoId));
    return urls
      .filter(url => {
        const id = videoIdFromUrl(url);
        return id && !existing.has(id);
      })
      .map(url => ({
        videoId: videoIdFromUrl(url) ?? url,
        url,
        status: 'pending' as ItemStatus,
        checked: true,
        enriched: false,
        activeSection: null,
      }));
  }

  async function handleBulkFetch(url: string) {
    setRunning(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) return;
      const existing = new Set(queue.map(i => i.videoId));
      const seen = new Set<string>();
      const newItems: QueueItem[] = (data.items as Array<{ videoId: string; url: string; title: string; channel: string }>)
        .filter(i => {
          if (existing.has(i.videoId) || seen.has(i.videoId)) return false;
          seen.add(i.videoId);
          return true;
        })
        .map(i => ({
          videoId: i.videoId, url: i.url,
          status: 'fetched' as ItemStatus,
          title: i.title, channel: i.channel,
          draft: { youtube_url: i.url, yt_title: i.title, _oembed: { title: i.title, channel: i.channel } },
          checked: true, enriched: false, activeSection: null,
        }));
      if (newItems.length) {
        const dupes = await checkForDuplicates(newItems);
        setQueue(q => [...q, ...tagDuplicates(newItems, dupes)]);
      }
    } catch { /* silent */ }
    setRunning(false);
  }

  async function handleExtract() {
    const listId   = extractPlaylistId(text);
    const channelId = extractChannelId(text);
    if (listId)    { setText(''); await handleBulkFetch(`/api/admin/fetch-playlist?list=${encodeURIComponent(listId)}`); return; }
    if (channelId) { setText(''); await handleBulkFetch(`/api/admin/fetch-channel?handle=${encodeURIComponent(channelId)}`); return; }
    const urls = extractUrls(text);
    if (!urls.length) return;
    const newItems = buildNewUrlItems(urls);
    if (!newItems.length) return;
    const dupes = await checkForDuplicates(newItems);
    const tagged = tagDuplicates(newItems, dupes);
    setQueue(q => [...q, ...tagged]);
    setText('');
    fetchItems(tagged.filter(i => i.status === 'pending'));
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (mode !== 'url') return;
    const pasted = e.clipboardData.getData('text');
    const listId    = extractPlaylistId(pasted);
    const channelId = extractChannelId(pasted);
    if (listId)    { e.preventDefault(); await handleBulkFetch(`/api/admin/fetch-playlist?list=${encodeURIComponent(listId)}`); return; }
    if (channelId) { e.preventDefault(); await handleBulkFetch(`/api/admin/fetch-channel?handle=${encodeURIComponent(channelId)}`); return; }
    if (!autoExtract) return;
    const urls = extractUrls(pasted);
    if (!urls.length) return;
    e.preventDefault();
    const newItems = buildNewUrlItems(urls);
    if (!newItems.length) return;
    const dupes = await checkForDuplicates(newItems);
    const tagged = tagDuplicates(newItems, dupes);
    setQueue(q => [...q, ...tagged]);
    fetchItems(tagged.filter(i => i.status === 'pending'));
  }

  async function fetchItems(items: QueueItem[]) {
    setRunning(true);
    for (const item of items) {
      updateItem(item.videoId, { status: 'fetching' });
      try {
        const res = await fetch(`/api/admin/fetch-song?url=${encodeURIComponent(item.url)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
        updateItem(item.videoId, {
          status: 'fetched',
          title:   data.draft?._oembed?.title   ?? data.draft?.title_original ?? item.url,
          channel: data.draft?._oembed?.channel ?? '',
          draft:   data.draft,
        });
      } catch (err) {
        updateItem(item.videoId, { status: 'error', error: err instanceof Error ? err.message : 'Fetch error' });
      }
    }
    setRunning(false);
  }

  async function fetchAll() {
    await fetchItems(queue.filter(i => i.status === 'pending'));
  }

  // ── Name mode ─────────────────────────────────────────────────────────────────

  async function handleNameSearch() {
    const names = text.split('\n').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    setText('');
    setRunning(true);
    for (const name of names) {
      const tempId = `name-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setQueue(q => [...q, {
        videoId: tempId, url: '', status: 'researching',
        title: name, channel: '', checked: true, enriched: false, activeSection: null,
      }]);
      try {
        const res = await fetch('/api/admin/enrich-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: name, titleMode: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Research failed');
        const ytUrl  = (data.enriched?.youtube_url ?? '') as string;
        const realId = videoIdFromUrl(ytUrl);
        if (realId && ytUrl) {
          setQueue(q => q.map(i => i.videoId === tempId ? {
            ...i, videoId: realId, url: ytUrl,
            status: 'fetched', enriched: true, activeSection: 'metadata',
            draft: { ...data.enriched },
          } : i));
        } else {
          setQueue(q => q.map(i => i.videoId === tempId
            ? { ...i, status: 'error', error: 'No YouTube URL found' } : i));
        }
      } catch (err) {
        setQueue(q => q.map(i => i.videoId === tempId
          ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Research failed' } : i));
      }
    }
    setRunning(false);
  }

  // ── Shared actions ────────────────────────────────────────────────────────────

  async function researchOneItem(item: QueueItem) {
    updateItem(item.videoId, { status: 'researching' });
    try {
      const res = await fetch('/api/admin/enrich-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       (item.draft?._oembed as { title?: string } | undefined)?.title ?? item.title ?? '',
          channel:     (item.draft?._oembed as { channel?: string } | undefined)?.channel ?? item.channel ?? '',
          youtube_url: item.url,
          videoId:     item.videoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Research failed');
      const e = data.enriched;
      const d = item.draft ?? {};
      updateItem(item.videoId, {
        status: 'fetched', enriched: true, activeSection: 'metadata',
        draft: {
          ...d,
          title_original:        e.title_original        ?? d.title_original,
          title_chinese:         e.title_chinese         ?? d.title_chinese,
          artist:                e.artist                ?? d.artist,
          language_claimed:      e.language_claimed      ?? d.language_claimed,
          ethnic_group_claimed:  e.ethnic_group_claimed  ?? d.ethnic_group_claimed,
          genre:                 e.genre                 ?? d.genre,
          recording_type:        e.recording_type        ?? d.recording_type,
          year:                  e.year                  ?? d.year,
          album_or_source:       e.album_or_source       ?? d.album_or_source,
          lyrics_original:       e.lyrics_original       ?? d.lyrics_original,
          lyrics_translation_zh: e.lyrics_translation_zh ?? d.lyrics_translation_zh,
          lyrics_translation_en: e.lyrics_translation_en ?? d.lyrics_translation_en,
          lyrics_source:         e.lyrics_source         ?? d.lyrics_source,
          notes:                 e.notes                 ?? d.notes,
        },
      });
    } catch (err) {
      updateItem(item.videoId, { status: 'error', error: err instanceof Error ? err.message : 'Research failed' });
    }
  }

  async function researchSelected() {
    setRunning(true);
    for (const item of queue.filter(i => i.checked && i.status === 'fetched')) {
      await researchOneItem(item);
    }
    setRunning(false);
  }

  async function saveItem(item: QueueItem) {
    if (!item.draft) return;
    updateItem(item.videoId, { status: 'saving' });
    try {
      const hasLyrics = !!(item.draft.lyrics_original || item.draft.lyrics_translation_zh || item.draft.lyrics_translation_en || item.draft.lyrics_source);
      const payload = {
        ...item.draft,
        lyrics: hasLyrics ? {
          song_id:               item.draft.id,
          lyrics_original:       item.draft.lyrics_original       ?? null,
          lyrics_translation_zh: item.draft.lyrics_translation_zh ?? null,
          lyrics_translation_en: item.draft.lyrics_translation_en ?? null,
          lyrics_source:         item.draft.lyrics_source         ?? null,
          show_publicly:         item.draft.show_publicly === true,
        } : null,
        lyrics_original: undefined, lyrics_translation_zh: undefined,
        lyrics_translation_en: undefined, lyrics_source: undefined,
        show_publicly: undefined,
      };
      const res = await fetch('/api/admin/save-song', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      updateItem(item.videoId, { status: 'saved', activeSection: null });
    } catch (err) {
      updateItem(item.videoId, { status: 'error', error: err instanceof Error ? err.message : 'Save error' });
    }
  }

  async function saveAll() {
    setRunning(true);
    for (const item of queue.filter(i => i.status === 'fetched')) await saveItem(item);
    setRunning(false);
  }

  const checkedFetched = queue.filter(i => i.checked && i.status === 'fetched').length;
  const allChecked = queue.length > 0 && queue.every(i => i.checked);
  const counts = {
    pending:    queue.filter(i => i.status === 'pending').length,
    fetched:    queue.filter(i => i.status === 'fetched').length,
    saved:      queue.filter(i => i.status === 'saved').length,
    errors:     queue.filter(i => i.status === 'error').length,
    duplicates: queue.filter(i => i.status === 'duplicate').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">

      {/* Header: title + URL/Name toggle + mode action */}
      <div className="flex items-center gap-3 shrink-0">
        <h2 className="text-white font-bold text-lg">Add Songs</h2>
        <div className="flex gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            onClick={() => { setMode('url'); setText(''); }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === 'url' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            By URL
          </button>
          <button
            onClick={() => { setMode('name'); setText(''); }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === 'name' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            By name
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {mode === 'url' && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoExtract}
                  onChange={e => setAutoExtract(e.target.checked)}
                  className="accent-violet-400"
                />
                <span className="text-[10px] text-stone-500 whitespace-nowrap">Auto-extract on paste</span>
              </label>
              <button
                onClick={() => void handleExtract()}
                disabled={!text.trim() || running}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Extract
              </button>
            </>
          )}
          {mode === 'name' && (
            <button
              onClick={() => void handleNameSearch()}
              disabled={!text.trim() || running}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <span>✦</span>
              Research with AI
            </button>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 flex flex-col gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              mode === 'url' ? void handleExtract() : void handleNameSearch();
            }
          }}
          placeholder={mode === 'url'
            ? 'Paste YouTube URLs — auto-fetched on paste.\nhttps://www.youtube.com/watch?v=…\nhttps://youtu.be/…\n\nOr paste a whole page of text — URLs will be extracted.'
            : 'Enter song names to find, one per line:\nSenay za Temuali\'an\nInaaw\n\nAI will search for the YouTube video for each name.'}
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder-stone-700 focus:outline-none focus:border-white/30 transition-colors resize-y font-mono leading-relaxed"
        />
      </div>

      {/* Action bar */}
      {queue.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 flex-wrap border-t border-white/5 pt-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={e => setQueue(q => q.map(i => ({ ...i, checked: e.target.checked })))}
              className="accent-violet-400"
            />
            <span className="text-xs text-stone-400">All</span>
          </label>

          <button
            onClick={() => void researchSelected()}
            disabled={running || checkedFetched === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <span>✦</span>
            Research{checkedFetched > 0 ? ` (${checkedFetched})` : ''}
          </button>

          <div className="flex items-center gap-2 ml-auto text-xs tabular-nums">
            {counts.saved      > 0 && <span className="text-emerald-400">✓ {counts.saved} saved</span>}
            {counts.errors     > 0 && <span className="text-red-400">✗ {counts.errors} errors</span>}
            {counts.duplicates > 0 && <span className="text-stone-500">{counts.duplicates} in library</span>}
            <button
              onClick={() => { if (window.confirm('Clear all songs from the queue?')) setQueue([]); }}
              disabled={running}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold transition-colors disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={() => void saveAll()}
              disabled={running || counts.fetched === 0}
              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-semibold transition-colors disabled:opacity-40"
            >
              Save all ({counts.fetched})
            </button>
          </div>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className={`flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-0.5 ${SCROLLBAR}`}>
          {queue.map(item => {
            const d = item.draft ?? {};
            return (
              <div key={item.videoId} className={`shrink-0 flex items-start gap-2 ${item.status === 'duplicate' ? 'opacity-40' : ''}`}>
                {/* Checkbox — outside card, aligns with "All" above */}
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={e => updateItem(item.videoId, { checked: e.target.checked })}
                  disabled={item.status === 'saved' || item.status === 'duplicate'}
                  className="mt-[10px] accent-violet-400 shrink-0"
                />

                {/* Card */}
                <div className="flex-1 min-w-0 rounded-lg bg-white/5 border border-white/5 overflow-hidden">

                {/* Row header — click to expand/collapse */}
                <div
                  className={`flex items-center gap-2 px-2.5 py-1.5 ${item.status === 'fetched' ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (item.status !== 'fetched') return;
                    updateItem(item.videoId, { activeSection: item.activeSection !== null ? null : 'metadata' });
                  }}
                >

                  <div className="shrink-0 w-[48px] h-[27px] rounded overflow-hidden bg-stone-800">
                    {item.url ? (
                      <img
                        src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-600 text-[10px]">—</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.title ? (
                      <>
                        <p className="text-xs text-white font-medium truncate leading-tight">{item.title}</p>
                        {item.channel && <p className="text-[10px] text-stone-500 truncate">{item.channel}</p>}
                      </>
                    ) : (
                      <p className="text-[10px] text-stone-600 font-mono truncate">{item.url}</p>
                    )}
                    {item.error && <p className="text-[9px] text-red-400 truncate">{item.error}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {item.status !== 'fetched' && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    )}
                    {item.status === 'fetched' && item.enriched && (
                      <span className="text-violet-400 text-[10px] leading-none">✦</span>
                    )}
                    {item.status === 'fetched' && (
                      <>
                        {/* Metadata / Lyrics segmented control */}
                        <div className="flex gap-0.5 bg-white/5 border border-white/10 rounded p-0.5">
                          <button
                            onClick={() => updateItem(item.videoId, { activeSection: item.activeSection === 'metadata' ? null : 'metadata' })}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                              item.activeSection === 'metadata' ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >Metadata</button>
                          <button
                            onClick={() => updateItem(item.videoId, { activeSection: item.activeSection === 'lyrics' ? null : 'lyrics' })}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                              item.activeSection === 'lyrics' ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-stone-300'
                            }`}
                          >Lyrics</button>
                        </div>
                        {/* AI research — icon only */}
                        <button
                          onClick={() => void researchOneItem(item)}
                          disabled={running}
                          title="Research with AI"
                          className="w-6 h-6 flex items-center justify-center text-[11px] rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40"
                        >✦</button>
                        {/* Save */}
                        <button
                          onClick={() => void saveItem(item)}
                          disabled={running}
                          className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                        >✓ Save</button>
                      </>
                    )}
                    {item.status === 'error' && (
                      <button
                        onClick={() => void fetchItems([item])}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-400 hover:text-white transition-colors"
                      >Retry</button>
                    )}
                    {item.status === 'duplicate' && (
                      <>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES.duplicate}`}>
                          {STATUS_LABELS.duplicate}
                        </span>
                        <button
                          onClick={() => setQueue(q => q.filter(i => i.videoId !== item.videoId))}
                          className="text-[11px] text-stone-600 hover:text-stone-400 transition-colors leading-none"
                          title="Dismiss"
                        >✕</button>
                      </>
                    )}
                  </div>

                  {item.status === 'fetched' && (
                    <span className={`shrink-0 text-stone-500 text-[12px] leading-none select-none inline-block transition-transform duration-150 ${
                      item.activeSection !== null ? 'rotate-90' : ''
                    }`}>›</span>
                  )}
                </div>

                {/* Inline edit form */}
                {item.activeSection !== null && item.status === 'fetched' && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5">

                    {item.activeSection === 'metadata' && (
                      <div className="flex flex-col gap-3 mt-3">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 items-start">
                          {/* Left column */}
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500">YouTube title</span>
                              <p className="text-xs italic px-2 py-1.5 bg-white/[0.03] rounded border border-white/5 leading-snug text-stone-400">
                                {(d._oembed as { title?: string } | undefined)?.title ?? <span className="text-stone-600 not-italic">—</span>}
                              </p>
                            </div>
                            <InlineField label="Title (original)" value={String(d.title_original ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'title_original', v)} />
                            <InlineField label="Title (Chinese)"  value={String(d.title_chinese ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'title_chinese', v || null)} />
                            <InlineField label="Title (English)"  value={String(d.title_en ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'title_en', v || null)} />
                            <InlineField label="Artist credit"    value={String(d.artist ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'artist', v)} />
                            <InlineField label="Year"             value={String(d.year ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'year', v || null)} />
                            <InlineField label="Album / Source"   value={String(d.album_or_source ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'album_or_source', v || null)} />
                            <InlineSelect label="Language"        value={String(d.language_claimed ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'language_claimed', v || null)} options={LANGUAGES} />
                          </div>
                          {/* Right column */}
                          <div className="flex flex-col gap-3">
                            <InlineSelect label="Status"          value={String(d.verification_status ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'verification_status', v || null)} options={VERIFICATION_STATUSES} />
                            <InlineSelect label="Ethnic group"    value={String(d.ethnic_group_claimed ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'ethnic_group_claimed', v || null)} options={LANGUAGES} />
                            <InlineSelect label="Genre"           value={String(d.genre ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'genre', v || null)} options={GENRES} />
                            <InlineSelect label="Performance"     value={String(d.recording_type ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'recording_type', v || null)} options={RECORDING_TYPES} />
                            <InlineField label="Location"         value={String(d.location_claimed ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'location_claimed', v || null)} />
                            <InlineField label="Region"           value={String(d.region ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'region', v || null)} />
                            <InlineField label="Non-YouTube URL"  value={String(d.url ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'url', v || null)} />
                            <InlineField label="Tags (comma-separated)"
                              value={Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : ''}
                              onChange={v => updateDraftField(item.videoId, 'tags', v.split(',').map((t: string) => t.trim()).filter(Boolean))} />
                          </div>
                        </div>
                        <InlineField label="Description (public)" value={String(d.description ?? '')}
                          onChange={v => updateDraftField(item.videoId, 'description', v || null)} multiline />
                        <InlineField label="Notes" value={String(d.notes ?? '')}
                          onChange={v => updateDraftField(item.videoId, 'notes', v || null)} multiline />
                      </div>
                    )}

                    {item.activeSection === 'lyrics' && (
                      <div className="flex flex-col gap-3 mt-3">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <InlineField label="Lyrics source" value={String(d.lyrics_source ?? '')}
                              onChange={v => updateDraftField(item.videoId, 'lyrics_source', v || null)} />
                          </div>
                          <button
                            type="button"
                            onClick={() => updateDraftField(item.videoId, 'show_publicly', !d.show_publicly)}
                            className={`shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-semibold transition-colors ${
                              d.show_publicly
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-stone-500 hover:bg-white/8 hover:text-stone-300'
                            }`}
                          >
                            <div className={`relative w-5 h-2.5 rounded-full transition-colors shrink-0 ${d.show_publicly ? 'bg-emerald-500' : 'bg-white/15'}`}>
                              <span className={`absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-white shadow transition-transform duration-200 ${d.show_publicly ? 'translate-x-2.5' : ''}`} />
                            </div>
                            Public
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <InlineField label="Original"  value={String(d.lyrics_original ?? '')}
                            onChange={v => updateDraftField(item.videoId, 'lyrics_original', v || null)} multiline />
                          <InlineField label="Chinese"   value={String(d.lyrics_translation_zh ?? '')}
                            onChange={v => updateDraftField(item.videoId, 'lyrics_translation_zh', v || null)} multiline />
                          <InlineField label="English"   value={String(d.lyrics_translation_en ?? '')}
                            onChange={v => updateDraftField(item.videoId, 'lyrics_translation_en', v || null)} multiline />
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
