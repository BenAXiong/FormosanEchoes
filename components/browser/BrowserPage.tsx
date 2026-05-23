'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Song, Artist, FilterState } from '@/lib/types';

const CIP_LANGUAGES = [
  { value: 'Amis', label: 'Amis 阿美族語' },
  { value: 'Atayal', label: 'Atayal 泰雅族語' },
  { value: 'Paiwan', label: 'Paiwan 排灣族語' },
  { value: 'Bunun', label: 'Bunun 布農族語' },
  { value: 'Puyuma', label: 'Puyuma 卑南族語' },
  { value: 'Rukai', label: 'Rukai 魯凱族語' },
  { value: 'Tsou', label: 'Tsou 鄒族語' },
  { value: 'Saisiyat', label: 'Saisiyat 賽夏族語' },
  { value: 'Tao (Yami)', label: 'Tao 達悟族語' },
  { value: 'Thao', label: 'Thao 邵族語' },
  { value: 'Kavalan', label: 'Kavalan 噶瑪蘭族語' },
  { value: 'Truku', label: 'Truku 太魯閣族語' },
  { value: 'Sakizaya', label: 'Sakizaya 撒奇萊雅族語' },
  { value: 'Seediq', label: 'Seediq 賽德克族語' },
  { value: "Hla'alua", label: "Hla'alua 拉阿魯哇族語" },
  { value: 'Kanakanavu', label: 'Kanakanavu 卡那卡那富族語' },
];

const GENRES = [
  { value: 'Traditional',                         label: 'Traditional',        icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><polygon points="6,1 11.5,11 0.5,11"/></svg> },
  { value: 'Traditional Choral',                  label: 'Traditional Choral', icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><rect x="0.5" y="2" width="2.5" height="8" rx="1.25"/><rect x="4.75" y="2" width="2.5" height="8" rx="1.25"/><rect x="9" y="2" width="2.5" height="8" rx="1.25"/></svg> },
  { value: 'Modern Folk',                         label: 'Modern Folk',        icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><circle cx="3.5" cy="9.5" r="2.5"/><rect x="5.7" y="0.5" width="1.5" height="9.3"/></svg> },
  { value: 'Contemporary Folk',                   label: 'Contemporary Folk',  icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><circle cx="2.5" cy="9.5" r="2"/><circle cx="8.5" cy="8.5" r="2"/><rect x="4.2" y="1.5" width="1.2" height="8.2"/><rect x="10.1" y="1.5" width="1.2" height="7.2"/><rect x="4.2" y="1.5" width="7.1" height="1.5"/></svg> },
  { value: 'Contemporary Indigenous Folk-Pop',    label: 'Folk-Pop',           icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><path d="M6 0 L7.1 4.9 L12 6 L7.1 7.1 L6 12 L4.9 7.1 L0 6 L4.9 4.9 Z"/></svg> },
  { value: 'Indigenous Gospel / Folk',            label: 'Gospel / Folk',      icon: <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden><rect x="4.5" y="0" width="3" height="12" rx="1.5"/><rect x="0" y="3.5" width="12" height="3" rx="1.5"/></svg> },
] as const;

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
import { useLang, useT } from '@/lib/lang';
import UserProfile from '@/components/browser/UserProfile';
import ShareModal, { type ShareTarget } from '@/components/ShareModal';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';

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
  initialSongId?: string;
  initialArtistId?: string;
  initialPlaylistId?: string;
}

export default function BrowserPage({ songs, artists, initialSongId, initialArtistId, initialPlaylistId }: Props) {
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
  const [genreOpen, setGenreOpen] = useState(false);
  const [showPlaylistsView, setShowPlaylistsView] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [songMenu, setSongMenu] = useState<{ song: Song; rect: DOMRect } | null>(null);
  const [songMenuView, setSongMenuView] = useState<'main' | 'playlists'>('main');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentVisibleCount, setRecentVisibleCount] = useState(10);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<'songs' | 'lyrics'>('songs');
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const bookmarkDropdownRef = useRef<HTMLDivElement>(null);
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const { playingTrack, playTrack, clearTrack, setQueue, setAutoAdvance, isFavorite, toggleFavorite, playlists, addSongToPlaylist, createPlaylist, deletePlaylist, registerTogglePanelFn, karaokeMode, toggleKaraokeMode, isSignedIn } = usePlayer();
  const t = useT();
  const { lang, toggleLang } = useLang();
  const router = useRouter();

  const goHome = useCallback(() => {
    setSelected(null);
    setSelectedArtist(null);
    setActiveTab('songs');
    setFilters(f => ({ ...f, only_favorites: false, playlist_id: null }));
    setShowPlaylistsView(false);
  }, []);

  const openShare = useCallback(async (target: ShareTarget) => {
    const type = target.url.includes('?song=') ? 'song' : target.url.includes('?artist=') ? 'artist' : 'playlist';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url: `${target.url}&utm_source=native`, title: target.title, text: target.text });
        track('share', { type, platform: 'native' });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    track('share', { type, platform: 'modal' });
    setShareTarget(target);
  }, []);

  // Consume deep-link params on first mount, then clear the URL
  useEffect(() => {
    if (initialSongId) {
      const song = songs.find(s => s.id === initialSongId);
      if (song) { setSelected(song); playTrack(song, songs); }
    } else if (initialArtistId) {
      const artist = artists.find(a => a.id === initialArtistId);
      if (artist) { setActiveTab('artists'); setSelectedArtist(artist); }
    } else if (initialPlaylistId) {
      fetch(`/api/playlists/${initialPlaylistId}`)
        .then(r => r.json())
        .then(({ songIds }: { songIds: string[] }) => {
          const queue = songIds.map(id => songs.find(s => s.id === id)).filter((s): s is Song => !!s);
          if (queue.length) { playTrack(queue[0], queue); setSelected(queue[0]); }
        })
        .catch(() => {});
    }
    if (initialSongId || initialArtistId || initialPlaylistId) {
      const type = initialSongId ? 'song' : initialArtistId ? 'artist' : 'playlist';
      track('deep-link', { type });
      router.replace('/', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

  // History API refs for PWA back-button handling
  const songHistoryPushed = useRef(false);
  const skipNextPop = useRef(false);
  const selectedRef = useRef<Song | null>(null);
  const isLargeScreenRef = useRef(false);
  const selectedArtistRef = useRef<Artist | null>(null);
  const showPlaylistsViewRef = useRef(false);
  const activeTabRef = useRef<'songs' | 'artists'>('songs');

  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 1024) setCompact(true);
    setIsLargeScreen(window.innerWidth >= 1024);
    setShowSongZh(localStorage.getItem('fe-show-song-zh') !== 'false');
    setShowArtistZh(localStorage.getItem('fe-show-artist-zh') === 'true');
    const savedLang = localStorage.getItem('fe-default-language');
    if (savedLang) {
      setDefaultLanguage(savedLang);
      setFilters(f => ({ ...f, language: savedLang, artist_id: '' }));
    }
    const saved = localStorage.getItem('fe-recent-searches');
    if (saved) { try { setRecentSearches(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  useEffect(() => { if (mounted) localStorage.setItem('fe-show-song-zh', String(showSongZh)); }, [showSongZh, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fe-show-artist-zh', String(showArtistZh)); }, [showArtistZh, mounted]);

  useEffect(() => {
    if (!bookmarkOpen || !bookmarkDropdownRef.current) return;
    const rect = bookmarkDropdownRef.current.getBoundingClientRect();
    if (rect.left < 8) {
      bookmarkDropdownRef.current.style.transform = `translateX(${8 - rect.left}px)`;
    } else {
      bookmarkDropdownRef.current.style.transform = '';
    }
  }, [bookmarkOpen]);

  const saveRecentSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 100);
      localStorage.setItem('fe-recent-searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSetDefaultLanguage = useCallback((lang: string) => {
    setDefaultLanguage(lang);
    if (lang) {
      localStorage.setItem('fe-default-language', lang);
    } else {
      localStorage.removeItem('fe-default-language');
    }
    setFilters(f => ({ ...f, language: lang, artist_id: '' }));
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

  // Analytics: search (debounced to avoid firing on every keystroke)
  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      track('song-search', { query, mode: searchMode, result_count: results.length });
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searchMode, results.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics: filter changes (compare against previous to detect which field changed)
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = filters;
    if (!mounted) return;
    if (filters.language !== prev.language && filters.language) {
      track('filter-language', { language: filters.language });
    }
    if (filters.genre !== prev.genre && filters.genre) {
      track('filter-genre', { genre: filters.genre });
    }
    if (filters.has_lyrics !== prev.has_lyrics) {
      track('filter-lyrics', { enabled: !!filters.has_lyrics });
    }
  }, [filters, mounted]);

  // Analytics: tab switch
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (!mounted || activeTab === prevTabRef.current) return;
    prevTabRef.current = activeTab;
    track('tab-switch', { tab: activeTab });
  }, [activeTab, mounted]);

  // Analytics: artist panel open
  useEffect(() => {
    if (selectedArtist) track('artist-open', { artist_id: selectedArtist.id, name: selectedArtist.name_display });
  }, [selectedArtist?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs in sync for use inside stable callbacks
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { isLargeScreenRef.current = isLargeScreen; }, [isLargeScreen]);
  useEffect(() => { selectedArtistRef.current = selectedArtist; }, [selectedArtist]);
  useEffect(() => { showPlaylistsViewRef.current = showPlaylistsView; }, [showPlaylistsView]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Push a history entry when the mobile sheet opens; replace when switching songs
  useEffect(() => {
    if (isLargeScreen || !selected) return;
    if (!songHistoryPushed.current) {
      history.pushState({ nav: 'song' }, '');
      songHistoryPushed.current = true;
    } else {
      history.replaceState({ nav: 'song' }, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, isLargeScreen]);

  // Push history when switching to artists tab so back returns to songs
  useEffect(() => {
    if (!mounted || activeTab !== 'artists') return;
    history.pushState({ nav: 'artists' }, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Push history when opening playlist view so back closes it
  useEffect(() => {
    if (!mounted || !showPlaylistsView) return;
    history.pushState({ nav: 'playlists' }, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlaylistsView]);

  // Intercept hardware/gesture back button in PWA
  useEffect(() => {
    const onPop = () => {
      if (skipNextPop.current) { skipNextPop.current = false; return; }
      if (selectedRef.current && !isLargeScreenRef.current) {
        songHistoryPushed.current = false;
        setSelected(null);
        if (karaokeMode) toggleKaraokeMode();
      } else if (showPlaylistsViewRef.current) {
        setShowPlaylistsView(false);
      } else if (activeTabRef.current === 'artists') {
        setActiveTab('songs');
        setSelectedArtist(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    registerTogglePanelFn(() => {
      if (selectedRef.current) {
        if (songHistoryPushed.current) {
          skipNextPop.current = true;
          history.back();
          songHistoryPushed.current = false;
        }
        setSelected(null);
        if (karaokeMode) toggleKaraokeMode();
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

  const overlayResults = useMemo(() => {
    if (query.length < 2) return [];
    return searchSongs(songs, query).slice(0, 30);
  }, [songs, query]);

  useEffect(() => {
    if (searchOverlayOpen) {
      setTimeout(() => overlayInputRef.current?.focus(), 50);
    } else if (query.length >= 2) {
      saveRecentSearch(query);
    }
  }, [searchOverlayOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className={`h-screen flex overflow-hidden bg-[#0a0a0f] text-white select-none ${(mounted && playingTrack) ? 'pb-29 sm:pb-20' : ''}`}>

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
          onClose={() => setSidebarOpen(false)}
          defaultLanguage={defaultLanguage}
          onSetDefaultLanguage={handleSetDefaultLanguage}
          onLogoClick={goHome}
        />
      </div>

      {/* Center */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="sticky top-0 z-20 bg-[#0f0f16] border-b border-white/5">
          <div className="lg:hidden flex items-center px-4 py-3 border-b border-white/5">
            <button onClick={goHome} className="flex items-center hover:opacity-80 transition-opacity" aria-label={t('goHome')}>
              <img src="/FE_logo_1d.png" alt="Logo" className="w-7 h-7 object-contain mr-2" />
              <span className="text-white font-bold text-sm tracking-tight">{t('appName')}</span>
            </button>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => setSearchOverlayOpen(true)}
                aria-label="Search"
                className="text-white hover:text-stone-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={toggleLang}
                aria-label={t('langToggleLabel')}
                className="hover:opacity-70 transition-opacity"
              >
                <span className="text-xl leading-none select-none">🌐</span>
              </button>
              <UserProfile />
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5">
            <button
              onClick={() => { setSidebarOpen(true); clearTrack(); }}
              className="lg:hidden p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-colors shrink-0"
              aria-label="Open filters"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
              </svg>
            </button>
            <div className="hidden lg:block relative flex-1 min-w-0 max-w-[22vw]">
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
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-3 py-1.5 text-sm text-white
                  placeholder-stone-600 focus:outline-none focus:border-white/20 transition-colors"
                autoComplete="off"
              />
              {/* Recent searches dropdown */}
              {searchFocused && query.length === 0 && recentSearches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 px-3 pt-3 pb-1">{t('recentSearches')}</p>
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
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={toggleLyricsFilter}
                aria-label={t('filterHasLyrics')}
                aria-pressed={!!filters.has_lyrics}
                className={`hidden lg:flex p-2 rounded-full transition-colors border shrink-0 ${
                  filters.has_lyrics
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 11h10M4 16h13" />
                </svg>
              </button>
              {/* Genre filter */}
              <div className="relative hidden lg:block">
                <button
                  onClick={() => setGenreOpen(o => !o)}
                  aria-label={t('filterByGenre')}
                  aria-pressed={!!filters.genre}
                  className={`p-2 rounded-full transition-colors border ${
                    filters.genre
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {filters.genre
                    ? <span className="w-3.5 h-3.5 flex items-center justify-center">{GENRES.find(g => g.value === filters.genre)?.icon}</span>
                    : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <circle cx="9" cy="18" r="3"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 18V7l9-2v11"/><circle cx="21" cy="16" r="3"/>
                      </svg>
                  }
                </button>
                {genreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setGenreOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      {filters.genre && (
                        <button
                          onClick={() => { setFilters(f => ({ ...f, genre: '' })); setGenreOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          {t('clearGenreFilter')}
                        </button>
                      )}
                      {GENRES.map(g => (
                        <button
                          key={g.value}
                          onClick={() => { setFilters(f => ({ ...f, genre: g.value })); setGenreOpen(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                            filters.genre === g.value
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'text-stone-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="w-3 h-3 shrink-0 flex items-center justify-center">{g.icon}</span>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Bookmark / Library */}
              <div
                className="relative hidden lg:block"
                onMouseEnter={() => setBookmarkOpen(true)}
                onMouseLeave={() => setBookmarkOpen(false)}
              >
                <button
                  onClick={() => setShowPlaylistsView(v => !v)}
                  aria-label={t('library')}
                  aria-pressed={!!(filters.only_favorites || filters.playlist_id || showPlaylistsView)}
                  className={`p-2 rounded-full transition-colors border ${
                    (filters.only_favorites || filters.playlist_id || showPlaylistsView)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-white/5 text-stone-400 border-white/10 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill={filters.only_favorites || filters.playlist_id ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4.5L5 21V5z"/>
                  </svg>
                </button>
                {bookmarkOpen && (
                  <div ref={bookmarkDropdownRef} className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <button
                      onClick={() => { setFilters(f => ({ ...f, only_favorites: !f.only_favorites, playlist_id: null })); setBookmarkOpen(false); setShowPlaylistsView(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${filters.only_favorites ? 'bg-emerald-500/10 text-emerald-300' : 'text-stone-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                      <span className="truncate flex-1 text-left">{t('favoriteSongs')}</span>
                      <span className="ml-auto text-stone-600 tabular-nums text-[10px]">{songs.filter(s => isFavorite(s.id)).length}</span>
                    </button>
                    {playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => { setFilters(f => ({ ...f, playlist_id: f.playlist_id === pl.id ? null : pl.id, only_favorites: false })); setBookmarkOpen(false); setShowPlaylistsView(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${filters.playlist_id === pl.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-stone-300 hover:bg-white/5 hover:text-white'}`}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>
                        <span className="truncate flex-1 text-left">{pl.name}</span>
                        <span className="ml-auto text-stone-600 tabular-nums text-[10px]">{pl.songIds.length}</span>
                      </button>
                    ))}
                    {!isSignedIn && (
                      <p className="px-3 py-2 text-[10px] text-stone-600 italic border-t border-white/5 mt-1">{t('signInToCreatePlaylists')}</p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={toggleLang}
                aria-label={t('langToggleLabel')}
                className="hidden lg:flex px-2 py-1 rounded-lg text-[11px] font-semibold tracking-wide text-stone-400 hover:text-white hover:bg-white/8 transition-colors"
              >
                {lang === 'en' ? '中' : 'EN'}
              </button>
              <button
                onClick={() => setCompact(!compact)}
                aria-pressed={compact}
                aria-label={t('toggleCompactView')}
                title={compact ? t('switchToGridView') : t('switchToCompactView')}
                className={`hidden lg:block p-1.5 rounded-lg transition-colors ${compact ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-white hover:bg-white/8'}`}
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

              {/* Settings dropdown */}
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen(o => !o)}
                  aria-label={t('displaySettings')}
                  className={`p-1.5 rounded-lg transition-colors ${settingsOpen ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-white hover:bg-white/8'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 px-3 pt-3 pb-1">{t('display')}</p>
                      <div className="p-2">
                        <ToggleRow label={t('songChineseNames')} value={showSongZh} onChange={setShowSongZh} />
                        <ToggleRow label={t('artistChineseNames')} value={showArtistZh} onChange={setShowArtistZh} />
                      </div>
                      <div className="border-t border-white/5 p-2">
                        <ToggleRow label={t('autoplay')} value={autoplay} onChange={setAutoplay} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile filter pills — replaces toolbar buttons on small screens */}
          <div className="lg:hidden flex items-center gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

            {/* Genre pill */}
            <div className="relative shrink-0">
              <button
                onClick={() => setGenreOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
                  filters.genre
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/8 text-stone-400 border-white/10 active:bg-white/12'
                }`}
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <circle cx="9" cy="18" r="3"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 18V7l9-2v11"/><circle cx="21" cy="16" r="3"/>
                </svg>
                <span className="whitespace-nowrap">
                  {filters.genre ? (GENRES.find(g => g.value === filters.genre)?.label ?? t('genre')) : t('genre')}
                </span>
              </button>
              {genreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setGenreOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {filters.genre && (
                      <button
                        onClick={() => { setFilters(f => ({ ...f, genre: '' })); setGenreOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        {t('clearGenreFilter')}
                      </button>
                    )}
                    {GENRES.map(g => (
                      <div
                        key={g.value}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-600 cursor-not-allowed select-none"
                        aria-disabled="true"
                      >
                        <span className="w-3 h-3 shrink-0 flex items-center justify-center opacity-40">{g.icon}</span>
                        {g.label}
                      </div>
                    ))}
                    <p className="px-3 py-2 text-[10px] text-stone-700 italic border-t border-white/5">Genre filter coming soon</p>
                  </div>
                </>
              )}
            </div>

            {/* Lyrics pill */}
            <button
              onClick={toggleLyricsFilter}
              aria-pressed={!!filters.has_lyrics}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 transition-colors ${
                filters.has_lyrics
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/8 text-stone-400 border-white/10 active:bg-white/12'
              }`}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 11h10M4 16h13" />
              </svg>
              <span className="whitespace-nowrap">{t('lyricsLabel')}</span>
            </button>

            {/* Library / playlists pill */}
            <button
              onClick={() => setShowPlaylistsView(v => !v)}
              aria-pressed={!!(filters.only_favorites || filters.playlist_id || showPlaylistsView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border shrink-0 transition-colors ${
                (filters.only_favorites || filters.playlist_id || showPlaylistsView)
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-white/8 text-stone-400 border-white/10 active:bg-white/12'
              }`}
            >
              <svg className="w-3 h-3 shrink-0" fill={filters.only_favorites || filters.playlist_id ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-4.5L5 21V5z"/>
              </svg>
              <span className="whitespace-nowrap">{t('library')}</span>
            </button>

          </div>
        </div>

        {/* Floating layout toggle — mobile only, avoids PlayerBar */}
        <button
          onClick={() => setCompact(!compact)}
          aria-pressed={compact}
          aria-label={t('toggleCompactView')}
          className={`lg:hidden fixed right-8 z-30 p-[18px] rounded-full border shadow-lg backdrop-blur-sm transition-all duration-300 ${
            playingTrack ? 'bottom-44' : 'bottom-12'
          } ${compact ? 'bg-white/20 text-white border-white/25' : 'bg-[#1a1a24]/90 text-stone-400 border-white/10'}`}
        >
          {compact ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 sm:px-5 py-5">
          {showPlaylistsView ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white">{t('library')}</h2>
                {isSignedIn && (
                  <button
                    onClick={() => createPlaylist('New Playlist')}
                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    {t('newPlaylist')}
                  </button>
                )}
              </div>
              <ul className={compact ? 'flex flex-col gap-1' : 'grid gap-4'} style={compact ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                <li>
                  <button
                    onClick={() => { setFilters(f => ({ ...f, only_favorites: !f.only_favorites, playlist_id: null })); setShowPlaylistsView(false); }}
                    className={`w-full rounded-xl overflow-hidden border transition-colors hover:bg-white/10 ${filters.only_favorites ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-white/5 border-white/5'}`}
                  >
                    <div className="relative aspect-square bg-gradient-to-br from-rose-900/40 to-rose-800/20 flex items-center justify-center">
                      <svg className="w-9 h-9 text-rose-500/70" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] tabular-nums text-stone-300">{songs.filter(s => isFavorite(s.id)).length}</span>
                    </div>
                    <div className="p-2.5 text-left">
                      <p className="text-xs font-semibold text-white truncate">{t('favoriteSongs')}</p>
                    </div>
                  </button>
                </li>
                {playlists.map(pl => {
                  const firstSong = pl.songIds.map(id => songs.find(s => s.id === id)).find((s): s is Song => !!s);
                  const ytId = firstSong?.youtube_url && isYouTubeUrl(firstSong.youtube_url) ? getYouTubeId(firstSong.youtube_url) : null;
                  return (
                    <li key={pl.id} className="relative group">
                      {confirmDeleteId === pl.id ? (
                        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-3" style={{ minHeight: 130 }}>
                          <p className="text-xs text-stone-400 leading-snug flex-1">{t('deletePlaylistConfirm', { name: pl.name })}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { deletePlaylist(pl.id); if (filters.playlist_id === pl.id) setFilters(f => ({ ...f, playlist_id: null })); setConfirmDeleteId(null); }}
                              className="flex-1 py-1 rounded-md bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                            >{t('yes')}</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="flex-1 py-1 rounded-md bg-white/5 text-stone-400 text-xs hover:bg-white/10 transition-colors"
                            >{t('no')}</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setFilters(f => ({ ...f, playlist_id: f.playlist_id === pl.id ? null : pl.id, only_favorites: false })); setShowPlaylistsView(false); }}
                            className={`w-full rounded-xl overflow-hidden border transition-colors hover:bg-white/10 ${filters.playlist_id === pl.id ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-white/5 border-white/5'}`}
                          >
                            <div className="relative aspect-square bg-white/5 flex items-center justify-center overflow-hidden">
                              {ytId ? (
                                <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" aria-hidden className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <svg className="w-8 h-8 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                                </svg>
                              )}
                              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] tabular-nums text-stone-300">{pl.songIds.length}</span>
                            </div>
                            <div className="p-2.5 text-left">
                              <p className="text-xs font-semibold text-white truncate">{pl.name}</p>
                            </div>
                          </button>
                          <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/?playlist=${pl.id}`; openShare({ url, title: pl.name }); }}
                              className="w-6 h-6 rounded-md bg-black/60 flex items-center justify-center text-stone-400 hover:text-white transition-colors"
                              aria-label={t('sharePlaylist')}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                            </button>
                            {isSignedIn && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(pl.id); }}
                                className="w-6 h-6 rounded-md bg-black/60 flex items-center justify-center text-stone-400 hover:text-red-400 transition-colors"
                                aria-label={t('deletePlaylistAriaLabel', { name: pl.name })}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!isSignedIn && (
                <p className="text-xs text-stone-600 italic mt-4">{t('signInToCreatePlaylists')}</p>
              )}
            </>
          ) : activeTab === 'artists' ? (
            filteredArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <span className="text-4xl text-stone-700" aria-hidden>♪</span>
                <p className="text-stone-500 text-sm">{t('noArtistsMatch')}</p>
                <button
                  onClick={() => { setArtistQuery(''); setArtistLanguage(''); }}
                  className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-2"
                >{t('clear')}</button>
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
              <p className="text-stone-500 text-sm">{t('noSongsMatch')}</p>
              <button
                onClick={() => { setQuery(''); setFilters(INITIAL_FILTERS); }}
                className="text-xs text-stone-400 hover:text-white transition-colors underline underline-offset-2"
              >{t('clearAll')}</button>
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
                    onOpenMenu={(s, rect) => { setSongMenu({ song: s, rect }); setSongMenuView('main'); }}
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
                    onOpenMenuAtPlaylists={(s, rect) => { setSongMenu({ song: s, rect }); setSongMenuView('playlists'); }}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Lyrics matches — songs tab only */}
          {!showPlaylistsView && activeTab === 'songs' && query.length >= 2 && (lyricsLoading || lyricsResults.length > 0) && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">{t('lyricsMatches')}</p>
                {lyricsLoading
                  ? <span className="text-[10px] text-stone-600 animate-pulse">{t('searchingIndicator')}</span>
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
              onShare={openShare}
            />
          ) : activeTab === 'songs' && selected ? (
            <NowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} onShare={openShare} />
          ) : (
            <div className="relative flex flex-col items-center justify-center h-full px-8 text-center bg-[#07070a] overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none">
                <img src="/FE_logo_1d.png" alt="" className="w-full h-full object-cover" />
              </div>
              <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center">
                <p className="text-white/20 text-sm max-w-xs">
                  {activeTab === 'artists'
                    ? t('selectArtist')
                    : t('selectSong')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet — only mount when not on a large screen to avoid dual NowPlaying registration */}
      {!isLargeScreen && selected && (
        <div className={`lg:hidden fixed inset-x-0 top-13 ${playingTrack ? 'bottom-29 sm:bottom-0' : 'bottom-0'} z-30 rounded-none overflow-hidden border-t border-white/10 shadow-2xl`}>
          <NowPlaying song={selected} onClose={() => setSelected(null)} autoplay={autoplay} onShare={openShare} />
        </div>
      )}

      {/* Mobile search overlay */}
      {searchOverlayOpen && (
        <div className="lg:hidden fixed inset-0 z-60 bg-[#0a0a0f] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-3 py-3 border-b border-white/8 shrink-0">
            <button
              onClick={() => setSearchOverlayOpen(false)}
              aria-label={t('back')}
              className="p-1.5 -ml-1 text-stone-400 hover:text-white transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <input
              ref={overlayInputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRecentSearch(query); }}
              placeholder={t('searchOverlayPlaceholder')}
              className="flex-1 bg-transparent text-white placeholder-stone-600 text-sm focus:outline-none min-w-0"
              autoComplete="off"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-stone-600 hover:text-white transition-colors shrink-0"
                aria-label="Clear"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => setSearchMode(m => m === 'songs' ? 'lyrics' : 'songs')}
              className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border border-white/15 text-stone-400 hover:text-white hover:border-white/30 transition-colors"
            >
              {searchMode === 'songs' ? t('searchModeLyrics') : t('searchModeSongs')}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            {query.length < 2 ? (
              recentSearches.length > 0 ? (
                <div className="py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 px-5 mb-2">{t('recentSearches')}</p>
                  {recentSearches.slice(0, recentVisibleCount).map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="w-full text-left flex items-center gap-3 px-5 py-2.5 text-sm text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 text-stone-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {term}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-stone-700 text-sm">{t('startTypingToSearch')}</p>
                </div>
              )
            ) : searchMode === 'songs' ? (
              overlayResults.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-stone-600 text-sm">{t('noResults')}</p>
                </div>
              ) : (
                <ul className="py-2">
                  {overlayResults.map(song => {
                    const ytId = song.youtube_url && isYouTubeUrl(song.youtube_url) ? getYouTubeId(song.youtube_url) : null;
                    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                    return (
                      <li key={song.id}>
                        <button
                          onClick={() => { setSelected(song); playTrack(song, results); setSearchOverlayOpen(false); saveRecentSearch(query); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                        >
                          <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-white/8 flex items-center justify-center text-stone-600">
                            {thumb
                              ? <img src={thumb} alt="" aria-hidden className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              : <span aria-hidden>♪</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-white truncate">{song.title_original ?? song.title_chinese ?? '—'}</p>
                            {song.artist && <p className="text-xs text-stone-400 truncate">{song.artist}</p>}
                          </div>
                          {song.language_claimed && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-stone-500">{song.language_claimed}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : lyricsLoading ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-stone-600 text-sm animate-pulse">{t('searchingLyrics')}</p>
              </div>
            ) : lyricsResults.length === 0 ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-stone-600 text-sm">{t('noLyricsMatches')}</p>
              </div>
            ) : (
              <div className="py-2">
                {lyricsResults.map(match => {
                  const song = songById.get(match.song_id);
                  if (!song) return null;
                  const ytId = match.yt_url && isYouTubeUrl(match.yt_url) ? getYouTubeId(match.yt_url) : null;
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
                  return (
                    <button
                      key={match.song_id}
                      onClick={() => { setSelected(song); playTrack(song, results); setSearchOverlayOpen(false); saveRecentSearch(query); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-white/8 flex items-center justify-center text-stone-600">
                        {thumb
                          ? <img src={thumb} alt="" aria-hidden className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <span aria-hidden>♪</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-white truncate">{match.title}</p>
                        {match.artist_credit && <p className="text-xs text-stone-400 truncate">{match.artist_credit}</p>}
                        <p className="text-xs text-stone-600 italic truncate">"{match.snippet}"</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Song context menu */}
      {songMenu && (() => {
        const { song, rect } = songMenu;
        const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - rect.bottom : 999;
        const menuStyle: React.CSSProperties = {
          position: 'fixed',
          right: typeof window !== 'undefined' ? window.innerWidth - rect.right : 0,
          ...(spaceBelow > 230 ? { top: rect.bottom + 4 } : { bottom: (typeof window !== 'undefined' ? window.innerHeight : 0) - rect.top + 4 }),
          width: 208,
          zIndex: 60,
        };
        const liked = isFavorite(song.id);
        return (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setSongMenu(null)} />
            <div className="bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden" style={menuStyle}>
              {songMenuView === 'main' ? (
                <>
                  <div className="px-3 pt-2.5 pb-1.5 border-b border-white/5">
                    <p className="text-xs font-semibold text-white truncate">{song.title_original ?? song.title_chinese ?? song.artist ?? '—'}</p>
                    {song.artist && <p className="text-[10px] text-stone-500 truncate">{song.artist}</p>}
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/?song=${song.id}`;
                        setSongMenu(null);
                        openShare({ url, title: song.title_original ?? song.title_chinese ?? song.artist ?? '—' });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
                      {t('share')}
                    </button>
                    <button
                      onClick={() => { toggleFavorite(song.id); setSongMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className={`w-3.5 h-3.5 shrink-0 ${liked ? 'fill-current text-emerald-400' : ''}`} fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      {liked ? t('unlike') : t('like')}
                    </button>
                    <button
                      onClick={() => setSongMenuView('playlists')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      {t('addToPlaylist')}
                      <svg className="w-3 h-3 ml-auto shrink-0 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                    {song.artist_ids?.length ? (
                      <button
                        onClick={() => { const a = artistMap.get(song.artist_ids![0]); if (a) { setActiveTab('artists'); setSelectedArtist(a); } setSongMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        {t('openArtist')}
                      </button>
                    ) : null}
                    <button disabled className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-600 cursor-not-allowed">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {t('songInfo')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setSongMenuView('main')}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-stone-400 hover:text-white transition-colors border-b border-white/5"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    {t('addToPlaylist')}
                  </button>
                  <div className="py-1 max-h-56 overflow-y-auto thin-scrollbar">
                    {!isSignedIn && (
                      <div className="px-3 py-2.5 border-b border-white/5 mb-1">
                        <p className="text-[10px] text-stone-500">{t('signInToCreatePlaylists')}</p>
                      </div>
                    )}
                    {playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => { addSongToPlaylist(pl.id, song.id); setSongMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>
                        {pl.name}
                      </button>
                    ))}
                    {isSignedIn && (
                      <button
                        onClick={() => { createPlaylist('New Playlist', song.id); setSongMenu(null); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white transition-colors border-t border-white/5 mt-1"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                        {t('newPlaylist')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {shareTarget && (
        <ShareModal
          url={shareTarget.url}
          title={shareTarget.title}
          text={shareTarget.text}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
