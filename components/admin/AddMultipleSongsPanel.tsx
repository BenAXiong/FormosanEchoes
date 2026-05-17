'use client';
import { useState } from 'react';

type ItemStatus = 'pending' | 'fetching' | 'fetched' | 'saving' | 'saved' | 'error';

type QueueItem = {
  videoId: string;
  url: string;
  status: ItemStatus;
  title?: string;
  channel?: string;
  draft?: Record<string, unknown>;
  error?: string;
};

function extractUrls(text: string): string[] {
  // Captures video IDs from watch?v=, youtu.be/, and /shorts/
  const re = /(?:youtube\.com\/(?:watch\?(?:[^&\s"']*&)*v=|shorts\/)|youtu\.be\/)([\w-]{11})/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(`https://www.youtube.com/watch?v=${m[1]}`);
    }
  }
  return out;
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  pending:  'bg-stone-700 text-stone-300',
  fetching: 'bg-sky-500/20 text-sky-300 animate-pulse',
  fetched:  'bg-violet-500/20 text-violet-300',
  saving:   'bg-amber-500/20 text-amber-300 animate-pulse',
  saved:    'bg-emerald-500/20 text-emerald-300',
  error:    'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  pending:  'Pending',
  fetching: 'Fetching…',
  fetched:  'Ready',
  saving:   'Saving…',
  saved:    'Saved ✓',
  error:    'Error',
};

export default function AddMultipleSongsPanel() {
  const [text, setText] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);

  const updateItem = (videoId: string, patch: Partial<QueueItem>) =>
    setQueue(q => q.map(item => item.videoId === videoId ? { ...item, ...patch } : item));

  function handleExtract() {
    const urls = extractUrls(text);
    if (!urls.length) return;
    const existing = new Set(queue.map(i => i.videoId));
    const newItems: QueueItem[] = urls
      .filter(url => {
        const id = url.match(/([\w-]{11})$/)?.[1];
        return id && !existing.has(id);
      })
      .map(url => ({
        videoId: url.match(/([\w-]{11})$/)?.[1] ?? url,
        url,
        status: 'pending',
      }));
    setQueue(q => [...q, ...newItems]);
    setText('');
  }

  async function fetchAll() {
    setRunning(true);
    const pending = queue.filter(i => i.status === 'pending');
    for (const item of pending) {
      updateItem(item.videoId, { status: 'fetching' });
      try {
        const res = await fetch(`/api/admin/fetch-song?url=${encodeURIComponent(item.url)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Fetch failed');
        updateItem(item.videoId, {
          status: 'fetched',
          title:   data.draft?._oembed?.title    ?? data.draft?.title_original ?? item.url,
          channel: data.draft?._oembed?.channel  ?? '',
          draft:   data.draft,
        });
      } catch (err) {
        updateItem(item.videoId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Fetch error',
        });
      }
    }
    setRunning(false);
  }

  async function saveItem(item: QueueItem) {
    if (!item.draft) return;
    updateItem(item.videoId, { status: 'saving' });
    try {
      const res = await fetch('/api/admin/save-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      updateItem(item.videoId, { status: 'saved' });
    } catch (err) {
      updateItem(item.videoId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Save error',
      });
    }
  }

  async function saveAll() {
    setRunning(true);
    for (const item of queue.filter(i => i.status === 'fetched')) {
      await saveItem(item);
    }
    setRunning(false);
  }

  const counts = {
    pending:  queue.filter(i => i.status === 'pending').length,
    fetched:  queue.filter(i => i.status === 'fetched').length,
    saved:    queue.filter(i => i.status === 'saved').length,
    errors:   queue.filter(i => i.status === 'error').length,
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Add Multiple Songs</h2>
        <p className="text-stone-500 text-xs">
          Paste any text containing YouTube URLs — one per line, a playlist page, or mixed content.
          URLs are extracted automatically.
        </p>
      </div>

      {/* Paste area */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleExtract(); }}
          placeholder={
            'Paste YouTube URLs here:\nhttps://www.youtube.com/watch?v=…\nhttps://youtu.be/…\n\nOr paste a whole page of text — URLs will be extracted.'
          }
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder-stone-700
            focus:outline-none focus:border-white/30 transition-colors resize-y font-mono leading-relaxed"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleExtract}
            disabled={!text.trim()}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors disabled:opacity-40"
          >
            Extract URLs
          </button>
          <span className="text-stone-600 text-xs">⌘↵ to extract</span>
        </div>
      </div>

      {/* Action bar */}
      {queue.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap border-t border-white/5 pt-4">
          <button
            onClick={fetchAll}
            disabled={running || counts.pending === 0}
            className="px-4 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-sm font-semibold transition-colors disabled:opacity-40"
          >
            {running ? 'Working…' : `Fetch ${counts.pending > 0 ? `(${counts.pending})` : 'All'}`}
          </button>
          <button
            onClick={saveAll}
            disabled={running || counts.fetched === 0}
            className="px-4 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-semibold transition-colors disabled:opacity-40"
          >
            Save All ({counts.fetched} ready)
          </button>
          <div className="flex items-center gap-3 ml-auto text-xs tabular-nums">
            {counts.saved  > 0 && <span className="text-emerald-400">✓ {counts.saved} saved</span>}
            {counts.errors > 0 && <span className="text-red-400">✗ {counts.errors} errors</span>}
            <button
              onClick={() => setQueue([])}
              className="text-stone-600 hover:text-stone-400 transition-colors"
            >
              Clear list
            </button>
          </div>
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {queue.map(item => (
            <div
              key={item.videoId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5"
            >
              {/* Thumbnail */}
              <div className="shrink-0 w-14 h-10 rounded overflow-hidden bg-stone-800">
                <img
                  src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {item.title ? (
                  <>
                    <p className="text-sm text-white font-medium truncate leading-tight">{item.title}</p>
                    <p className="text-xs text-stone-500 truncate">{item.channel}</p>
                  </>
                ) : (
                  <p className="text-xs text-stone-600 font-mono truncate">{item.url}</p>
                )}
                {item.error && (
                  <p className="text-[10px] text-red-400 truncate mt-0.5">{item.error}</p>
                )}
              </div>

              {/* Status + save */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
                {item.status === 'fetched' && (
                  <button
                    onClick={() => saveItem(item)}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    Save
                  </button>
                )}
                {item.status === 'error' && (
                  <button
                    onClick={() => updateItem(item.videoId, { status: 'pending', error: undefined })}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-stone-400 hover:text-white transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
