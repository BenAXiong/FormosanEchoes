'use client';

import { useState, useMemo } from 'react';
import type { Song, FilterState, ControlledVocab } from '@/lib/types';
import { searchSongs } from '@/lib/search';
import { filterSongs, DEFAULT_FILTERS } from '@/lib/filters';
import SearchBar from '@/components/SearchBar';
import FilterBar from '@/components/FilterBar';
import SongCard from '@/components/SongCard';
import SongDetailPanel from '@/components/SongDetailPanel';
import AddSongPanel from '@/components/admin/AddSongPanel';
import AddMultipleSongsPanel from '@/components/admin/AddMultipleSongsPanel';
import ArtistAuditPanel from '@/components/admin/ArtistAuditPanel';
import MetricsPanel from '@/components/admin/MetricsPanel';
import SongAuditPanel from '@/components/admin/SongAuditPanel';
import vocab from '@/data/controlled-vocab.json';

const typedVocab = vocab as ControlledVocab;

type Tab = 'browse' | 'add' | 'artists' | 'metrics';
type AddMode = 'single' | 'multi' | 'audit';
type ArtistMode = 'add' | 'edit';

function SubTabBar<T extends string>({ tabs, active, onChange }: Readonly<{
  tabs: [T, string][];
  active: T;
  onChange: (t: T) => void;
}>) {
  return (
    <div className="flex gap-0 border-b border-white/10 px-6 pt-4">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-4 pb-3 text-xs font-semibold border-b-2 transition-colors
            ${active === id ? 'border-white text-white' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AddTab() {
  const [mode, setMode] = useState<AddMode>('single');
  return (
    <div className="bg-[#0f0f16] rounded-xl border border-white/10 min-h-100 overflow-hidden">
      <SubTabBar
        tabs={[['single', 'Single Song'], ['multi', 'Multiple Songs'], ['audit', 'Edit Songs']]}
        active={mode}
        onChange={setMode}
      />
      <div className="p-6">
        {mode === 'single' && <AddSongPanel />}
        {mode === 'multi' && <AddMultipleSongsPanel />}
        {mode === 'audit' && <SongAuditPanel />}
      </div>
    </div>
  );
}

function ArtistTab() {
  const [mode, setMode] = useState<ArtistMode>('edit');
  return (
    <div className="bg-[#0f0f16] rounded-xl border border-white/10 min-h-100 overflow-hidden">
      <SubTabBar
        tabs={[['edit', 'Edit Artists'], ['add', 'Add Artist']]}
        active={mode}
        onChange={setMode}
      />
      <div className="p-6">
        {mode === 'edit' && <ArtistAuditPanel />}
        {mode === 'add' && (
          <div className="flex items-center justify-center h-48 text-stone-600 text-sm italic">
            Add Artist — coming soon
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  songs: Song[];
}

export default function CurationView({ songs }: Props) {
  const [tab, setTab] = useState<Tab>('browse');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  const results = useMemo(() => {
    const searched = searchSongs(songs, query);
    return filterSongs(searched, filters);
  }, [songs, query, filters]);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 tracking-tight">
              Formosan Echoes
              <span className="ml-2 text-xs font-normal text-stone-400">台灣原住民音樂索引</span>
            </h1>
            <p className="text-xs text-stone-400 hidden sm:block">Formosan-language song metadata browser · all entries are candidates unless verified</p>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {(['browse', 'add', 'artists', 'metrics'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  tab === t
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {{ browse: 'Browse', add: 'Songs', artists: 'Artists', metrics: 'Metrics' }[t]}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400 tabular-nums hidden sm:inline">{results.length} / {songs.length}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Add Song tab ── */}
        {tab === 'add' && <AddTab />}

        {/* ── Artists tab ── */}
        {tab === 'artists' && <ArtistTab />}

        {/* ── Metrics tab ── */}
        {tab === 'metrics' && (
          <div className="bg-[#0f0f16] rounded-xl border border-white/10 min-h-100">
            <MetricsPanel />
          </div>
        )}

        {/* ── Browse tab ── */}
        {tab === 'browse' && (
          <>
            {/* Search */}
            <div className="mb-4">
              <SearchBar value={query} onChange={setQuery} />
            </div>

            {/* Filters */}
            <div className="mb-6 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
              <FilterBar filters={filters} onChange={setFilters} vocab={typedVocab} />
            </div>

        {/* Two-column layout on desktop */}
            <div className="flex gap-6 items-start">
              {/* Song list */}
              <section
                aria-label="Song list"
                className={`shrink-0 ${selectedSong ? 'w-full lg:w-80 xl:w-96' : 'w-full'}`}
              >
                {results.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
                    <p className="text-stone-400 text-sm">No songs match your search or filters.</p>
                    <p className="text-stone-300 text-xs mt-1">Try clearing the search or adjusting filters.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {results.map((song) => (
                      <li key={song.id}>
                        <SongCard
                          song={song}
                          isSelected={selectedSong?.id === song.id}
                          onSelect={setSelectedSong}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Detail panel */}
              {selectedSong && (
                <section
                  aria-label="Song detail"
                  className="hidden lg:block flex-1 min-w-0 bg-white rounded-xl border border-stone-200 p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Selected Song</span>
                    <button
                      onClick={() => setSelectedSong(null)}
                      className="text-stone-400 hover:text-stone-600 transition-colors text-xs"
                      aria-label="Close detail panel"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <SongDetailPanel song={selectedSong} />
                </section>
              )}
            </div>

            {/* Mobile: selected song appears below list */}
            {selectedSong && (
              <section
                aria-label="Song detail"
                className="lg:hidden mt-4 bg-white rounded-xl border border-stone-200 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Selected Song</span>
                  <button
                    onClick={() => setSelectedSong(null)}
                    className="text-stone-400 hover:text-stone-600 transition-colors text-xs"
                    aria-label="Close detail panel"
                  >
                    ✕ Close
                  </button>
                </div>
                <SongDetailPanel song={selectedSong} />
              </section>
            )}
          </>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4 border-t border-stone-200">
        <p className="text-xs text-stone-400 text-center">
          Formosan Echoes · Cultural metadata browser · All entries are candidates unless marked verified ·{' '}
          <span className="italic">Candidate data should not be cited as authoritative.</span>
        </p>
      </footer>
    </div>
  );
}
