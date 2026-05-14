'use client';
import { useState, useEffect } from 'react';

type UnlinkedItem = {
  song_artist_string: string;
  suggested_action: string;
};

export default function ArtistAuditPanel() {
  const [items, setItems] = useState<UnlinkedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState<string | null>(null);
  const [editArtist, setEditArtist] = useState<any | null>(null);
  const [status, setStatus] = useState('');

  async function fetchUnlinked() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/unlinked-artists');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUnlinked();
  }, []);

  async function handleResearch(name: string) {
    setResearching(name);
    setStatus(`Researching "${name}"...`);
    try {
      const res = await fetch('/api/admin/research-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Research failed');
      setEditArtist(data.research);
      setStatus('');
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setResearching(null);
    }
  }

  async function handleSave() {
    if (!editArtist) return;
    setStatus('Saving artist and running linker...');
    try {
      const res = await fetch('/api/admin/save-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editArtist),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      setStatus('✓ Artist saved and songs re-linked!');
      setEditArtist(null);
      fetchUnlinked();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Artist Audit</h2>
        <p className="text-stone-500 text-xs">Resolve artist strings that failed to link to the database.</p>
      </div>

      {status && (
        <div className="text-xs px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
          {status}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* List of unlinked */}
        <div className="space-y-3">
          <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Unlinked Strings ({items.length})</h3>
          {loading ? (
            <p className="text-stone-600 text-xs italic">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-emerald-500 text-xs font-semibold italic">✓ All artists linked!</p>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <span className="text-white text-xs font-medium truncate pr-4">{item.song_artist_string}</span>
                  <button
                    onClick={() => handleResearch(item.song_artist_string)}
                    disabled={researching !== null}
                    className="px-3 py-1 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold transition-colors disabled:opacity-40 shrink-0"
                  >
                    {researching === item.song_artist_string ? 'Researching...' : 'Research ✦'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit form */}
        <div className="space-y-4">
          <h3 className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Artist Metadata</h3>
          {!editArtist ? (
            <div className="h-64 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-stone-600 text-xs italic">
              Select an artist to research or edit
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Display Name</label>
                  <input
                    type="text"
                    value={editArtist.name_display || ''}
                    onChange={e => setEditArtist({ ...editArtist, name_display: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Ethnic Group</label>
                  <input
                    type="text"
                    value={editArtist.ethnic_group || ''}
                    onChange={e => setEditArtist({ ...editArtist, ethnic_group: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Language</label>
                  <input
                    type="text"
                    value={editArtist.language || ''}
                    onChange={e => setEditArtist({ ...editArtist, language: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="col-span-2">
                   <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Aliases (Romanized - comma separated)</label>
                   <input
                     type="text"
                     value={(editArtist.names_rom || []).join(', ')}
                     onChange={e => setEditArtist({ ...editArtist, names_rom: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                     className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                   />
                </div>
                <div className="col-span-2">
                   <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Aliases (Chinese - comma separated)</label>
                   <input
                     type="text"
                     value={(editArtist.names_zh || []).join(', ')}
                     onChange={e => setEditArtist({ ...editArtist, names_zh: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                     className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                   />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Bio (ZH)</label>
                <textarea
                  value={editArtist.bio_zh || ''}
                  rows={3}
                  onChange={e => setEditArtist({ ...editArtist, bio_zh: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 transition-colors"
                >
                  Save to Database
                </button>
                <button
                  onClick={() => setEditArtist(null)}
                  className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-stone-400 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
