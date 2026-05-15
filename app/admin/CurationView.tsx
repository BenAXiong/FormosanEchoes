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
import ArtistAuditPanel from '@/components/admin/ArtistAuditPanel';
import MetricsPanel from '@/components/admin/MetricsPanel';
import vocab from '@/data/controlled-vocab.json';

const typedVocab = vocab as ControlledVocab;

type Tab = 'browse' | 'add' | 'artists' | 'metrics';

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
                {t === 'browse' ? 'Browse' : t === 'add' ? '+ Add Song' : t === 'artists' ? 'Artists Audit' : 'Metrics'}
              </button>
            ))}
          </div>
          <span className="text-xs text-stone-400 tabular-nums hidden sm:inline">{results.length} / {songs.length}</span>
          <a
            href="/"
            className="text-xs px-3 py-1.5 rounded-full bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700 transition-colors"
          >
            Public →
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Add Song tab ── */}
        {tab === 'add' && (
          <div className="bg-[#0f0f16] rounded-xl border border-white/10 p-6 min-h-[400px]">
            <AddSongPanel />
          </div>
        )}

        {/* ── Artist Audit tab ── */}
        {tab === 'artists' && (
          <div className="bg-[#0f0f16] rounded-xl border border-white/10 p-6 min-h-[400px]">
            <ArtistAuditPanel />
          </div>
        )}

        {/* ── Metrics tab ── */}
        {tab === 'metrics' && (
          <div className="bg-[#0f0f16] rounded-xl border border-white/10 min-h-[400px]">
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
                className={`flex-shrink-0 ${selectedSong ? 'w-full lg:w-80 xl:w-96' : 'w-full'}`}
              >
                {results.length === 0 ? (
                  <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
                    <p className="text-stone-400 text-sm">No songs match your search or filters.</p>
                    <p className="text-stone-300 text-xs mt-1">Try clearing the search or adjusting filters.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2" role="list">
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
