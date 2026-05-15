'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Song, FilterState } from '@/lib/types';
import { getSongs } from '@/lib/data';
import { searchSongs } from '@/lib/search';
import { filterSongs, DEFAULT_FILTERS } from '@/lib/filters';
import DemoSongCard from '@/components/demo/DemoSongCard';
import DemoNowPlaying from '@/components/demo/DemoNowPlaying';
import DemoFilterSidebar from '@/components/demo/DemoFilterSidebar';
import { usePlayer } from '@/lib/PlayerContext';

const allSongs = getSongs();

const DEMO_DEFAULT_FILTERS: FilterState = { ...DEFAULT_FILTERS, has_lyrics: true };

function HeaderSelect({
  id, value, options, onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-300
        focus:outline-none focus:border-white/20 transition-colors cursor-pointer
        appearance-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#1a1a24] text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function DemoPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEMO_DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Song | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [compact, setCompact] = useState(false); // set per viewport in effect below
  const [panelWidth, setPanelWidth] = useState(640);
  const [mounted, setMounted] = useState(false);
  const { playingTrack, playTrack, setQueue } = usePlayer();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Default to compact on mobile (< lg breakpoint)
  useEffect(() => {
    if (window.innerWidth < 1024) setCompact(true);
  }, []);

  const toggleLyricsFilter = () =>
    setFilters((f) => ({ ...f, has_lyrics: f.has_lyrics ? null : true }));

  const results = useMemo(() => {
    const searched = searchSongs(allSongs, query);
    const filtered = filterSongs(searched, filters);
    return filtered;
  }, [query, filters]);

  // Sync queue with results when they change
  useEffect(() => {
    setQueue(results);
  }, [results, setQueue]);

  // Resizable panel drag
  const dragStart = useRef({ x: 0, w: 0 });
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: panelWidth };
    const onMove = (ev: MouseEvent) => {
      const delta = dragStart.current.x - ev.clientX;
      setPanelWidth(Math.max(320, Math.min(960, dragStart.current.w + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  return (
    <div className={`h-screen flex overflow-hidden bg-[#0a0a0f] text-white select-none ${(mounted && playingTrack) ? 'pb-20' : ''}`}>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <DemoFilterSidebar
          filters={filters}
          onChange={setFilters}
          resultCount={results.length}
          totalCount={allSongs.length}
          allSongs={allSongs}
        />
      </div>

      {/* Center */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Sticky header wrapper (mobile: two rows; desktop: toolbar only) ── */}
        <div className="sticky top-0 z-20 bg-[#0f0f16] border-b border-white/5">

          {/* Mobile Header Row: logo + title | profile */}
          <div className="lg:hidden flex items-center px-4 py-3 border-b border-white/5">
            <img src="/FE_logo_1d.png" alt="Logo" className="w-7 h-7 object-contain mr-2" />
            <span className="text-white font-bold text-sm tracking-tight">Formosan Echoes</span>
            <div className="ml-auto w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">B</div>
          </div>

          {/* Toolbar Row */}
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5">

          {/* Filter pane toggle — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors shrink-0"
            aria-label="Open filters"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
            </svg>
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" aria-hidden>
              <svg className="h-3.5 w-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="demo-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-3 py-1.5 text-sm text-white
                placeholder-stone-600 focus:outline-none focus:border-white/20 transition-colors"
              autoComplete="off"
            />
          </div>

          {/* Has lyrics toggle */}
          <button
            onClick={toggleLyricsFilter}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border shrink-0 ${
              filters.has_lyrics
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            ♪ Lyrics
          </button>

          {/* Compact + Autoplay */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Compact view */}
            <button
              onClick={() => setCompact(!compact)}
              aria-pressed={compact}
              aria-label="Toggle compact view"
              title={compact ? 'Switch to grid view' : 'Switch to compact view'}
              className={`p-1.5 rounded-lg transition-colors ${
                compact ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-white hover:bg-white/8'
              }`}
            >
              {compact ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            {/* Autoplay */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-500 hidden sm:inline">Autoplay</span>
              <button
                onClick={() => setAutoplay(!autoplay)}
                aria-pressed={autoplay}
                aria-label="Toggle autoplay"
                className={`relative w-9 h-5 rounded-full transition-colors ${autoplay ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${autoplay ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>{/* /compact+autoplay */}
          </div>{/* /toolbar row */}
        </div>{/* /sticky wrapper */}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto demo-sidebar px-4 sm:px-5 py-5">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <span className="text-4xl text-stone-700" aria-hidden>♪</span>
              <p className="text-stone-500 text-sm">No songs match your filters.</p>
              <button
                onClick={() => { setQuery(''); setFilters(DEMO_DEFAULT_FILTERS); }}
                className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-2"
              >Clear all</button>
            </div>
          ) : compact ? (
            <ul className="flex flex-col" role="list">
              {results.map((song) => (
                <li key={song.id}>
                  <DemoSongCard 
                    song={song} 
                    isSelected={selected?.id === song.id} 
                    isPlaying={playingTrack?.id === song.id}
                    onSelect={(s) => {
                      setSelected(s);
                      playTrack(s, results);
                    } } 
                    compact 
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}
              role="list"
            >
              {results.map((song) => (
                <li key={song.id}>
                  <DemoSongCard 
                    song={song} 
                    isSelected={selected?.id === song.id} 
                    isPlaying={playingTrack?.id === song.id}
                    onSelect={(s) => {
                      setSelected(s);
                      playTrack(s, results);
                    }} 
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Drag handle + right panel (desktop) */}
      <div className="hidden lg:flex shrink-0" style={{ width: panelWidth }}>
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="w-1 cursor-col-resize hover:bg-white/20 bg-white/5 transition-colors shrink-0"
          title="Drag to resize"
        />
        {/* Panel */}
        <div className="flex-1 border-l border-white/5 overflow-hidden flex flex-col">
          {selected ? (
            <DemoNowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-stone-600 text-3xl border border-white/10">♪</div>
              <p className="text-stone-500 text-sm">Select a song to start listening</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {selected && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 h-[90vh] rounded-t-2xl overflow-hidden border-t border-white/10 shadow-2xl">
          <DemoNowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} />
        </div>
      )}
    </div>
  );
}
