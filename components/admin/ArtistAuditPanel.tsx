'use client';
import { useState, useEffect, useRef } from 'react';

type UnlinkedItem = { song_artist_string: string; suggested_action: string };

type BatchResult = {
  string: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> | null;
  status: 'pending' | 'researching' | 'done' | 'error' | 'saved' | 'skipped';
  error?: string;
};

// ── Compact batch result card ─────────────────────────────────────────────────

function BatchCard({
  result,
  onSave,
  onSkip,
  onEdit,
}: {
  result: BatchResult;
  onSave: () => void;
  onSkip: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEdit: (data: Record<string, any>) => void;
}) {
  const { data, status, string: str } = result;

  if (status === 'pending')     return <div className="text-stone-700 text-[10px] px-3 py-2 italic">Queued: {str}</div>;
  if (status === 'researching') return <div className="text-violet-400 text-[10px] px-3 py-2 italic animate-pulse">Researching "{str}"…</div>;
  if (status === 'saved')       return <div className="text-emerald-500 text-[10px] px-3 py-2">✓ Saved: {data?.name_display ?? str}</div>;
  if (status === 'skipped')     return null;
  if (status === 'error')       return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-red-400 text-[10px]">✗ {str}: {result.error}</span>
      <button onClick={onSkip} className="text-stone-600 text-[10px] hover:text-stone-400 transition-colors">Dismiss</button>
    </div>
  );
  if (!data) return null;

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0">
        <p className="text-white text-xs font-semibold truncate">{data.name_display}</p>
        <p className="text-stone-500 text-[10px]">{[data.ethnic_group, data.language].filter(Boolean).join(' · ') || 'Unknown group/language'}</p>
        {data.bio_en && <p className="text-stone-600 text-[10px] line-clamp-1 mt-0.5">{data.bio_en}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={() => onEdit(data)} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-stone-400 text-[10px] transition-colors">Edit</button>
        <button onClick={onSkip}             className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-stone-500 text-[10px] transition-colors">Skip</button>
        <button onClick={onSave}             className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-colors">Save</button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ArtistAuditPanel() {
  const [items, setItems]           = useState<UnlinkedItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [researching, setResearching] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editArtist, setEditArtist] = useState<Record<string, any> | null>(null);
  const [status, setStatus]         = useState('');
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const abortRef = useRef(false);

  async function fetchUnlinked() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/unlinked-artists');
      const data = await res.json();
      setItems(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchUnlinked(); }, []);

  // ── Auto-link (no AI) ───────────────────────────────────────────────────────

  async function handleAutoLink() {
    setStatus('Auto-linking against existing artists…');
    const res  = await fetch('/api/admin/auto-link', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setStatus(data.linked > 0 ? `✓ ${data.linked} song(s) auto-linked` : '✓ No new matches found in DB');
      fetchUnlinked();
    } else {
      setStatus(`Error: ${data.error}`);
    }
  }

  // ── Single research ─────────────────────────────────────────────────────────

  async function handleResearch(name: string) {
    setResearching(name);
    setStatus(`Researching "${name}"…`);
    try {
      const res  = await fetch('/api/admin/research-artist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Research failed');
      setEditArtist(data.research);
      setBatchResults([]);
      setStatus('');
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Research failed'}`);
    } finally { setResearching(null); }
  }

  // ── Batch Gemini research ───────────────────────────────────────────────────

  async function handleBatchResearch() {
    const candidates = items.filter(i => i.song_artist_string !== 'Unknown / Traditional');
    if (candidates.length === 0) return;

    abortRef.current = false;
    setBatchRunning(true);
    setEditArtist(null);
    setStatus('');

    const initial: BatchResult[] = candidates.map(i => ({
      string: i.song_artist_string, data: null, status: 'pending',
    }));
    setBatchResults(initial);

    for (let i = 0; i < initial.length; i++) {
      if (abortRef.current) break;

      setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'researching' } : r));

      try {
        const res  = await fetch('/api/admin/research-artist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: initial[i].string }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Research failed');
        setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, data: data.research, status: 'done' } : r));
      } catch (err: unknown) {
        setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'Failed' } : r));
      }

      // Small pause between Gemini calls
      await new Promise(r => setTimeout(r, 400));
    }

    setBatchRunning(false);
  }

  function stopBatch() {
    abortRef.current = true;
    setBatchRunning(false);
  }

  // ── Save (single or batch) ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function saveArtist(artistData: Record<string, any>, batchIdx?: number) {
    try {
      const res  = await fetch('/api/admin/save-artist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(artistData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');

      const linked = data.songs_linked > 0 ? ` · ${data.songs_linked} song(s) linked` : '';

      if (batchIdx !== undefined) {
        setBatchResults(prev => prev.map((r, i) => i === batchIdx ? { ...r, status: 'saved' } : r));
        setStatus(`✓ "${artistData.name_display}" saved${linked}`);
      } else {
        setStatus(`✓ "${artistData.name_display}" saved${linked}`);
        setEditArtist(null);
      }
      fetchUnlinked();
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Save failed'}`);
    }
  }

  async function saveAllBatch() {
    const ready = batchResults.filter(r => r.status === 'done' && r.data);
    for (let i = 0; i < batchResults.length; i++) {
      const r = batchResults[i];
      if (r.status === 'done' && r.data) {
        await saveArtist(r.data, i);
        await new Promise(res => setTimeout(res, 150));
      }
    }
    setStatus(`✓ Saved ${ready.length} artist(s)`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const doneCount    = batchResults.filter(r => r.status === 'done').length;
  const savedCount   = batchResults.filter(r => r.status === 'saved').length;
  const hasBatch     = batchResults.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-lg mb-1">Artist Audit</h2>
          <p className="text-stone-500 text-xs">Resolve artist strings that failed to link to the database.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAutoLink}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-stone-300 text-xs font-semibold transition-colors"
          >
            ⚡ Auto-link known
          </button>
          {!batchRunning ? (
            <button
              onClick={handleBatchResearch}
              disabled={items.length === 0}
              className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-300 text-xs font-semibold transition-colors disabled:opacity-40"
            >
              ✦ Research All ({items.filter(i => i.song_artist_string !== 'Unknown / Traditional').length})
            </button>
          ) : (
            <button
              onClick={stopBatch}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors"
            >
              ✕ Stop
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          status.startsWith('✓')
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : status.startsWith('Error')
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          {status}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Left: unlinked list ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Unlinked Strings ({items.length})</h3>
          {loading ? (
            <p className="text-stone-600 text-xs italic">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-emerald-500 text-xs font-semibold italic">✓ All artists linked!</p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0 pr-3">
                    <p className="text-white text-xs font-medium truncate">{item.song_artist_string}</p>
                    <p className="text-stone-600 text-[10px] truncate mt-0.5">{item.suggested_action}</p>
                  </div>
                  <button
                    onClick={() => { setBatchResults([]); handleResearch(item.song_artist_string); }}
                    disabled={researching !== null || batchRunning}
                    className="px-3 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors disabled:opacity-40 shrink-0"
                  >
                    {researching === item.song_artist_string ? 'Researching…' : 'Research ✦'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: edit form or batch results ──────────────────────────── */}
        <div className="space-y-4">
          {hasBatch ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">
                  Batch Results
                  <span className="ml-2 normal-case font-normal text-stone-600">
                    {savedCount} saved · {doneCount} ready
                    {batchRunning && ` · researching…`}
                  </span>
                </h3>
                {doneCount > 0 && !batchRunning && (
                  <button
                    onClick={saveAllBatch}
                    className="px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition-colors"
                  >
                    Save All Ready
                  </button>
                )}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5">
                {batchResults.map((result, i) => (
                  <BatchCard
                    key={i}
                    result={result}
                    onSave={() => result.data && saveArtist(result.data, i)}
                    onSkip={() => setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'skipped' } : r))}
                    onEdit={data => { setEditArtist(data); setBatchResults([]); }}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Artist Metadata</h3>
              {!editArtist ? (
                <div className="h-64 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-stone-600 text-xs italic">
                  Select an artist to research or edit
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Display Name</label>
                      <input type="text" value={editArtist.name_display ?? ''} onChange={e => setEditArtist({ ...editArtist, name_display: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Ethnic Group</label>
                      <input type="text" value={editArtist.ethnic_group ?? ''} onChange={e => setEditArtist({ ...editArtist, ethnic_group: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Language</label>
                      <input type="text" value={editArtist.language ?? ''} onChange={e => setEditArtist({ ...editArtist, language: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white mt-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Aliases — Romanized (comma-separated)</label>
                      <input type="text" value={(editArtist.names_rom ?? []).join(', ')} onChange={e => setEditArtist({ ...editArtist, names_rom: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white mt-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Aliases — Chinese (comma-separated)</label>
                      <input type="text" value={(editArtist.names_zh ?? []).join(', ')} onChange={e => setEditArtist({ ...editArtist, names_zh: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white mt-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Bio (ZH)</label>
                    <textarea value={editArtist.bio_zh ?? ''} rows={3} onChange={e => setEditArtist({ ...editArtist, bio_zh: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white resize-none mt-1" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveArtist(editArtist)}
                      className="flex-1 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-colors">
                      Save to Database
                    </button>
                    <button onClick={() => setEditArtist(null)}
                      className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-stone-400 text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
