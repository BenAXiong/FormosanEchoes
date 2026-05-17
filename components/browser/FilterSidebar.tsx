'use client';
import { useState, useMemo } from 'react';
import { usePlayer } from '@/lib/PlayerContext';
import type { Artist, FilterState, Song } from '@/lib/types';
import { DEFAULT_FILTERS, hasActiveFilters } from '@/lib/filters';
import { getArtistsWithSongs } from '@/lib/artists';

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

const FIRST_N = 6;

function PillList({
  options, value, onChange, expandLabel, allCount,
}: {
  options: { value: string; label: string; count: number }[];
  value: string;
  onChange: (v: string) => void;
  expandLabel: string;
  allCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, FIRST_N);
  const rest = options.length - FIRST_N;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => onChange('')}
        className={`flex items-center px-3 py-1.5 rounded-lg text-xs transition-colors
          ${!value ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
      >
        <span className="flex-1 text-left">All</span>
        <span className="tabular-nums text-[10px] text-stone-600 shrink-0">{allCount}</span>
      </button>
      {visible.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? '' : o.value)}
          className={`flex items-center px-3 py-1.5 rounded-lg text-xs transition-colors
            ${value === o.value ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
        >
          <span className="flex-1 text-left truncate">{o.label}</span>
          <span className="tabular-nums text-[10px] text-stone-600 shrink-0 ml-2">{o.count}</span>
        </button>
      ))}
      {rest > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-left px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:text-stone-400 hover:bg-white/5 transition-colors"
        >{expanded ? '↑ Show less' : `+ ${rest} ${expandLabel}`}</button>
      )}
    </div>
  );
}



interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  totalCount: number;
  allSongs: Song[];
  allArtists: Artist[];
}

export default function FilterSidebar({ filters, onChange, resultCount, totalCount, allSongs, allArtists }: Props) {
  const { playlists } = usePlayer();
  
  const updateFilters = (updates: Partial<FilterState>) => {
    onChange({ ...filters, ...updates });
  };

  const set = (key: keyof FilterState, value: string | boolean | null) =>
    updateFilters({ [key]: value });

  const active = hasActiveFilters(filters);

  // Count songs per language across all songs
  const langCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSongs) {
      if (s.language_claimed) counts[s.language_claimed] = (counts[s.language_claimed] ?? 0) + 1;
    }
    return counts;
  }, [allSongs]);

  const langOptions = useMemo(() =>
    CIP_LANGUAGES
      .filter(l => (langCounts[l.value] ?? 0) > 0)
      .map(l => ({ ...l, count: langCounts[l.value] ?? 0 }))
      .sort((a, b) => b.count - a.count),
  [langCounts]);

  // Get artists who have at least 1 song in the current language-filtered pool
  const artistPool = useMemo(() =>
    filters.language ? allSongs.filter(s => s.language_claimed === filters.language) : allSongs,
  [allSongs, filters.language]);

  const artistOptions = useMemo(() =>
    getArtistsWithSongs(artistPool, allArtists)
      .map(a => ({
        value: a.id,
        label: a.name_display,
        count: artistPool.filter(s => (s.artist_ids ?? []).includes(a.id)).length,
      }))
      .sort((a, b) => b.count - a.count),
  [artistPool, allArtists]);

  const artistFilter = filters.artist_id;
  const setArtistFilter = (v: string) => set('artist_id', v);

  const RECORDING_TYPES = ['Studio', 'Live', 'Home Recording', 'Field Recording'];

  const recordingTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSongs) {
      if (s.recording_type) counts[s.recording_type] = (counts[s.recording_type] ?? 0) + 1;
    }
    return counts;
  }, [allSongs]);

  const recordingTypeOptions = useMemo(() =>
    RECORDING_TYPES
      .map(v => ({ value: v, label: v, count: recordingTypeCounts[v] ?? 0 }))
      .filter(o => o.count > 0)
      .sort((a, b) => b.count - a.count),
  [recordingTypeCounts]);

  return (
    <aside className="h-full flex flex-col bg-[#0f0f16] overflow-hidden">
      {/* Title */}
      <div className="px-4 py-4 border-b border-white/5 shrink-0 flex items-center gap-3">
        <img src="/FE_logo_1d.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" />
        <p className="text-white font-bold text-sm tracking-tight">Formosan Echoes</p>
      </div>

      {/* Library Section */}
      <div className="py-4 border-b border-white/5 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">Library</p>
        <div className="px-2 flex flex-col gap-0.5">
          <button
            onClick={() => updateFilters({ only_favorites: !filters.only_favorites, playlist_id: null })}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors
              ${filters.only_favorites ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
          >
            <svg className={`w-4 h-4 ${filters.only_favorites ? 'fill-emerald-500 text-emerald-500' : 'text-stone-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Favorite Songs
          </button>
          
          {playlists.map(p => (
            <button
              key={p.id}
              onClick={() => updateFilters({ playlist_id: filters.playlist_id === p.id ? null : p.id, only_favorites: false })}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors
                ${filters.playlist_id === p.id ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
            >
              <svg className={`w-4 h-4 ${filters.playlist_id === p.id ? 'text-white' : 'text-stone-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Count + clear */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02]">
        <p className="text-stone-500 text-xs tabular-nums">
          <span className="text-white font-semibold">{resultCount}</span>
          <span className="text-stone-600"> / {totalCount}</span>
        </p>
        {active && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-stone-500 hover:text-white transition-colors underline underline-offset-4"
          >Clear</button>
        )}
      </div>

      {/* Filter lists */}
      <div className="flex-1 py-4 overflow-y-auto thin-scrollbar">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">Languages</p>
          <div className="px-2">
            <PillList
              options={langOptions}
              value={filters.language}
              onChange={(v) => updateFilters({ language: v, artist_id: '' })}
              expandLabel="other languages"
              allCount={allSongs.length}
            />
          </div>
        </div>
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">
            Artists
            {filters.language && (
              <span className="ml-1 text-stone-700 normal-case font-normal tracking-normal">
                — {filters.language}
              </span>
            )}
          </p>
          <div className="px-2">
            {artistOptions.length > 0 ? (
              <PillList
                options={artistOptions}
                value={artistFilter}
                onChange={setArtistFilter}
                expandLabel="more artists"
                allCount={artistPool.length}
              />
            ) : (
              <p className="text-stone-700 text-xs px-3 italic">No artists yet</p>
            )}
          </div>
        </div>
        {recordingTypeOptions.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">Format</p>
            <div className="px-2">
              <PillList
                options={recordingTypeOptions}
                value={filters.recording_type}
                onChange={(v) => set('recording_type', v)}
                expandLabel="more types"
                allCount={allSongs.filter(s => !!s.recording_type).length}
              />
            </div>
          </div>
        )}
      </div>

      {/* User profile pill — bottom */}
      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">B</div>
          <div>
            <p className="text-white text-xs font-semibold leading-tight">Ben</p>
            <p className="text-stone-500 text-[10px]">Researcher</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
