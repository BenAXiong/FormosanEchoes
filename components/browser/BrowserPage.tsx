'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Song, Artist, FilterState } from '@/lib/types';

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      <span className="text-xs text-stone-300">{label}</span>
      <div className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ml-3 ${value ? 'bg-emerald-500' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${value ? 'translate-x-4' : ''}`} />
      </div>
    </button>
  );
}
import { searchSongs } from '@/lib/search';
import { getYouTubeId, isYouTubeUrl } from '@/lib/normalize';
import { filterSongs, DEFAULT_FILTERS } from '@/lib/filters';
import SongCard from '@/components/browser/SongCard';
import NowPlaying from '@/components/browser/NowPlaying';
import FilterSidebar from '@/components/browser/FilterSidebar';
import ArtistCard from '@/components/browser/ArtistCard';
import ArtistDetailPanel from '@/components/browser/ArtistDetailPanel';
import { usePlayer } from '@/lib/PlayerContext';

type LyricsMatch = {
  song_id: string;
  title: string;
  artist_credit: string | null;
  language: string | null;
  yt_url: string | null;
  snippet: string;
};

const INITIAL_FILTERS: FilterState = { ...DEFAULT_FILTERS };

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

interface Props {
  songs: Song[];
  artists: Artist[];
}

export default function BrowserPage({ songs, artists }: Props) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<Song | null>(null);
  const [activeTab, setActiveTab] = useState<'songs' | 'artists'>('songs');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistQuery, setArtistQuery] = useState('');
  const [artistLanguage, setArtistLanguage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [compact, setCompact] = useState(false);
  const [panelWidth, setPanelWidth] = useState(640);
  const [mounted, setMounted] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [showSongZh, setShowSongZh] = useState(true);
  const [showArtistZh, setShowArtistZh] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentVisibleCount, setRecentVisibleCount] = useState(10);
  const { playingTrack, playTrack, setQueue, setAutoAdvance, isFavorite, playlists, registerTogglePanelFn, karaokeMode, toggleKaraokeMode } = usePlayer();

  // History API refs for PWA back-button handling
  const historyDepth = useRef(0);
  const skipNextPop = useRef(false);
  const selectedRef = useRef<Song | null>(null);

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 1024) setCompact(true);
    setIsLargeScreen(window.innerWidth >= 1024);
    setShowSongZh(localStorage.getItem('fe-show-song-zh') !== 'false');
    setShowArtistZh(localStorage.getItem('fe-show-artist-zh') === 'true');
    const saved = localStorage.getItem('fe-recent-searches');
    if (saved) { try { setRecentSearches(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => { if (mounted) localStorage.setItem('fe-show-song-zh', String(showSongZh)); }, [showSongZh, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fe-show-artist-zh', String(showArtistZh)); }, [showArtistZh, mounted]);

  const saveRecentSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 100);
      localStorage.setItem('fe-recent-searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleLyricsFilter = () =>
    setFilters((f) => ({ ...f, has_lyrics: f.has_lyrics ? null : true }));

  const artistMap = useMemo(() => {
    const m = new Map<string, Artist>();
    for (const a of artists) m.set(a.id, a);
    return m;
  }, [artists]);

  const songCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of songs) {
      for (const id of s.artist_ids ?? []) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs]);

  const filteredArtists = useMemo(() => {
    let list = artists;
    if (artistLanguage) {
      list = list.filter(a => a.language === artistLanguage);
    }
    if (artistQuery.trim()) {
      const q = artistQuery.toLowerCase();
      list = list.filter(a =>
        a.name_display.toLowerCase().includes(q) ||
        a.names_zh.some(n => n.toLowerCase().includes(q)) ||
        a.names_en.some(n => n.toLowerCase().includes(q)) ||
        a.names_ab.some(n => n.toLowerCase().includes(q))
      );
    }
    return list;
  }, [artists, artistQuery, artistLanguage]);

  const results = useMemo(() => {
    const searched = searchSongs(songs, query);
    let filtered = filterSongs(searched, filters, artists);
    if (filters.only_favorites) filtered = filtered.filter(s => isFavorite(s.id));
    if (filters.playlist_id) {
      const playlist = playlists.find(p => p.id === filters.playlist_id);
      if (playlist) filtered = filtered.filter(s => playlist.songIds.includes(s.id));
    }
    return filtered;
  }, [query, filters, isFavorite, playlists, songs]);

  // Pool for sidebar counts: all filters active except language + artist_id,
  // so pill counts reflect what's actually reachable given query, lyrics toggle, etc.
  const sidebarPool = useMemo(() => {
    const searched = searchSongs(songs, query);
    let pool = filterSongs(searched, { ...filters, language: '', artist_id: '', recording_type: '' }, artists);
    if (filters.only_favorites) pool = pool.filter(s => isFavorite(s.id));
    if (filters.playlist_id) {
      const pl = playlists.find(p => p.id === filters.playlist_id);
      if (pl) pool = pool.filter(s => pl.songIds.includes(s.id));
    }
    return pool;
  }, [songs, query, filters, artists, isFavorite, playlists]);

  useEffect(() => { setQueue(results); }, [results, setQueue]);
  useEffect(() => { setAutoAdvance(autoplay); }, [autoplay, setAutoAdvance]);
  useEffect(() => { if (karaokeMode) toggleKaraokeMode(); }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs in sync for use inside stable callbacks
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Push a history entry when the mobile sheet opens; replace when switching songs
  useEffect(() => {
    if (isLargeScreen || !selected) return;
    if (historyDepth.current === 0) {
      history.pushState({ sheet: true }, '');
    } else {
      history.replaceState({ sheet: true }, '');
    }
    historyDepth.current = 1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, isLargeScreen]);

  // Intercept hardware/gesture back button in PWA
  useEffect(() => {
    const onPop = () => {
      if (skipNextPop.current) { skipNextPop.current = false; return; }
      setSelected(null);
      setKaraokeMode(false);
      historyDepth.current = 0;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    registerTogglePanelFn(() => {
      if (selectedRef.current) {
        if (historyDepth.current > 0) {
          skipNextPop.current = true;
          history.back();
          historyDepth.current = 0;
        }
        setSelected(null);
        setKaraokeMode(false);
      } else {
        setSelected(playingTrack ?? null);
      }
    });
    return () => registerTogglePanelFn(null);
  }, [registerTogglePanelFn, playingTrack]);

  const songById = useMemo(() => {
    const m = new Map<string, Song>();
    for (const s of songs) m.set(s.id, s);
    return m;
  }, [songs]);

  const [lyricsResults, setLyricsResults] = useState<LyricsMatch[]>([]);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setLyricsResults([]); setLyricsLoading(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLyricsLoading(true);
      try {
        const res = await fetch(`/api/search-lyrics?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) setLyricsResults(Array.isArray(data) ? data : []);
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setLyricsLoading(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);


  // Keep the NowPlaying panel in sync when the queue auto-advances
  useEffect(() => {
    if (!playingTrack || playingTrack.id === selected?.id) return;
    const inQueue = results.find(s => s.id === playingTrack.id);
    if (inQueue) setSelected(inQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingTrack?.id]);

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
    <div className={`h-screen flex overflow-hidden bg-[#0a0a0f] text-white select-none ${(mounted && playingTrack) ? 'pb-[116px] sm:pb-20' : ''}`}>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          resultCount={results.length}
          totalCount={songs.length}
          allSongs={sidebarPool}
          allArtists={artists}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          artistQuery={artistQuery}
          onArtistQueryChange={setArtistQuery}
          artistLanguage={artistLanguage}
          onArtistLanguageChange={setArtistLanguage}
          filteredArtistCount={filteredArtists.length}
        />
      </div>

      {/* Center */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="sticky top-0 z-20 bg-[#0f0f16] border-b border-white/5">
          <div className="lg:hidden flex items-center px-4 py-3 border-b border-white/5">
            <img src="/FE_logo_1d.png" alt="Logo" className="w-7 h-7 object-contain mr-2" />
            <span className="text-white font-bold text-sm tracking-tight">Formosan Echoes</span>
            <div className="ml-auto w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">B</div>
          </div>
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors shrink-0"
              aria-label="Open filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
              </svg>
            </button>
            <div className="relative flex-1 min-w-0 max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" aria-hidden>
                <svg className="h-3.5 w-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="song-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { setSearchFocused(true); setRecentVisibleCount(10); }}
                onBlur={() => { setSearchFocused(false); saveRecentSearch(query); }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRecentSearch(query); }}
                placeholder="Search…"
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-3 py-1.5 text-sm text-white
                  placeholder-stone-600 focus:outline-none focus:border-white/20 transition-colors"
                autoComplete="off"
              />
              {/* Recent searches dropdown */}
              {searchFocused && query.length === 0 && recentSearches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 px-3 pt-3 pb-1">Recent</p>
                  <div className="pb-2">
                    {recentSearches.slice(0, recentVisibleCount).map(term => (
                      <button
                        key={term}
                        onMouseDown={(e) => { e.preventDefault(); setQuery(term); saveRecentSearch(term); }}
                        className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3 text-stone-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {term}
                      </button>
                    ))}
                    {recentSearches.length > recentVisibleCount && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setRecentVisibleCount(c => c + 10); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-stone-600 hover:text-stone-400 hover:bg-white/5 transition-colors"
                      >+ {Math.min(10, recentSearches.length - recentVisibleCount)} more</button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleLyricsFilter}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border shrink-0 flex items-center gap-1.5 ${
                filters.has_lyrics
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
              }`}
            >
              ♪ Lyrics
            </button>
            <button
              onClick={() => setFilters({ ...filters, only_favorites: !filters.only_favorites })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border shrink-0 flex items-center gap-1.5 ${
                filters.only_favorites
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
              }`}
            >
              <svg className={`w-3 h-3 ${filters.only_favorites ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Liked
            </button>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={() => setCompact(!compact)}
                aria-pressed={compact}
                aria-label="Toggle compact view"
                title={compact ? 'Switch to grid view' : 'Switch to compact view'}
                className={`p-1.5 rounded-lg transition-colors ${compact ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-white hover:bg-white/8'}`}
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

              {/* Settings dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  aria-label="Display settings"
                  className={`p-1.5 rounded-lg transition-colors text-lg leading-none ${settingsOpen ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-white hover:bg-white/8'}`}
                >···</button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 px-3 pt-3 pb-1">Display</p>
                      <div className="p-2">
                        <ToggleRow label="Song Chinese names" value={showSongZh} onChange={setShowSongZh} />
                        <ToggleRow label="Artist Chinese names" value={showArtistZh} onChange={setShowArtistZh} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 sm:px-5 py-5">
          {activeTab === 'artists' ? (
            filteredArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <span className="text-4xl text-stone-700" aria-hidden>♪</span>
                <p className="text-stone-500 text-sm">No artists match your search.</p>
                <button
                  onClick={() => { setArtistQuery(''); setArtistLanguage(''); }}
                  className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-2"
                >Clear</button>
              </div>
            ) : (
              <ul
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}
              >
                {filteredArtists.map(artist => (
                  <li key={artist.id}>
                    <ArtistCard
                      artist={artist}
                      songCount={songCountMap.get(artist.id) ?? 0}
                      isSelected={selectedArtist?.id === artist.id}
                      onClick={() => setSelectedArtist(a => a?.id === artist.id ? null : artist)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <span className="text-4xl text-stone-700" aria-hidden>♪</span>
              <p className="text-stone-500 text-sm">No songs match your filters.</p>
              <button
                onClick={() => { setQuery(''); setFilters(INITIAL_FILTERS); }}
                className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-2"
              >Clear all</button>
            </div>
          ) : compact ? (
            <ul className="flex flex-col" role="list">
              {results.map((song) => (
                <li key={song.id}>
                  <SongCard
                    song={song}
                    isSelected={selected?.id === song.id}
                    isPlaying={playingTrack?.id === song.id}
                    onSelect={(s) => { setSelected(s); playTrack(s, results); }}
                    compact
                    artistMap={artistMap}
                    showSongZh={showSongZh}
                    showArtistZh={showArtistZh}
                    onArtistClick={isLargeScreen ? (id => { const a = artistMap.get(id); if (a) { setActiveTab('artists'); setSelectedArtist(a); } }) : undefined}
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
                  <SongCard
                    song={song}
                    isSelected={selected?.id === song.id}
                    isPlaying={playingTrack?.id === song.id}
                    onSelect={(s) => { setSelected(s); playTrack(s, results); }}
                    artistMap={artistMap}
                    showSongZh={showSongZh}
                    showArtistZh={showArtistZh}
                    onArtistClick={isLargeScreen ? (id => { const a = artistMap.get(id); if (a) { setActiveTab('artists'); setSelectedArtist(a); } }) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Lyrics matches — songs tab only */}
          {activeTab === 'songs' && query.length >= 2 && (lyricsLoading || lyricsResults.length > 0) && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Lyrics matches</p>
                {lyricsLoading
                  ? <span className="text-[10px] text-stone-600 animate-pulse">searching…</span>
                  : <span className="text-[10px] text-stone-700 tabular-nums">{lyricsResults.length}</span>
                }
              </div>
              <div className="flex flex-col gap-0.5">
                {lyricsResults.map(match => {
                  const song = songById.get(match.song_id);
                  if (!song) return null;
                  const ytId = match.yt_url && isYouTubeUrl(match.yt_url) ? getYouTubeId(match.yt_url) : null;
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                  return (
                    <button
                      key={match.song_id}
                      onClick={() => { setSelected(song); playTrack(song); }}
                      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-white/5">
                        {thumb
                          ? <img src={thumb} alt="" aria-hidden className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <span className="w-full h-full flex items-center justify-center text-stone-600 text-base" aria-hidden>♪</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{match.title}</p>
                        {match.artist_credit && (
                          <p className="text-xs text-stone-400 truncate">{match.artist_credit}</p>
                        )}
                        <p className="text-xs text-stone-600 italic truncate">"{match.snippet}"</p>
                      </div>
                      {match.language && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-stone-500">
                          {match.language}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Right panel (desktop) */}
      <div className="hidden lg:flex shrink-0" style={{ width: panelWidth }}>
        <div
          onMouseDown={handleDragStart}
          className="w-1 cursor-col-resize hover:bg-white/20 bg-white/5 transition-colors shrink-0"
          title="Drag to resize"
        />
        <div className="flex-1 border-l border-white/5 overflow-hidden flex flex-col">
          {activeTab === 'artists' && selectedArtist ? (
            <ArtistDetailPanel
              artist={selectedArtist}
              songs={songs}
              allArtists={artists}
              onClose={() => setSelectedArtist(null)}
              onSelectSong={song => { setActiveTab('songs'); setSelected(song); playTrack(song); }}
              onSelectArtist={setSelectedArtist}
            />
          ) : activeTab === 'songs' && selected ? (
            <NowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} />
          ) : (
            <div className="relative flex flex-col items-center justify-center h-full px-8 text-center bg-[#07070a] overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none">
                <img src="/FE_logo_1d.png" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center">
                <p className="text-white/20 text-sm max-w-xs">
                  {activeTab === 'artists'
                    ? 'Select an artist to view their profile'
                    : 'Select a song from the library to explore its history and lyrics'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet — only mount when not on a large screen to avoid dual NowPlaying registration */}
      {!isLargeScreen && selected && (
        <div className={`lg:hidden fixed inset-x-0 top-[52px] ${playingTrack ? 'bottom-[116px] sm:bottom-0' : 'bottom-0'} z-30 rounded-none overflow-hidden border-t border-white/10 shadow-2xl`}>
          <NowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} />
        </div>
      )}
    </div>
  );
}
