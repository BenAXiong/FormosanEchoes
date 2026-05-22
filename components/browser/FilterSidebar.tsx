'use client';
import { useState, useMemo } from 'react';
import { useT } from '@/lib/lang';
import type { Artist, FilterState, Song } from '@/lib/types';
import UserProfile from './UserProfile';
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
  const t = useT();
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
        <span className="flex-1 text-left">{t('all')}</span>
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
        >{expanded ? t('showLess') : `+ ${rest} ${expandLabel}`}</button>
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
  activeTab: 'songs' | 'artists';
  onTabChange: (t: 'songs' | 'artists') => void;
  artistQuery: string;
  onArtistQueryChange: (q: string) => void;
  artistLanguage: string;
  onArtistLanguageChange: (l: string) => void;
  filteredArtistCount: number;
  onClose?: () => void;
  defaultLanguage: string;
  onSetDefaultLanguage: (lang: string) => void;
  onLogoClick?: () => void;
}

export default function FilterSidebar({
  filters, onChange, resultCount, totalCount, allSongs, allArtists,
  activeTab, onTabChange, artistQuery, onArtistQueryChange,
  artistLanguage, onArtistLanguageChange, filteredArtistCount, onClose,
  defaultLanguage, onSetDefaultLanguage, onLogoClick,
}: Props) {
  const t = useT();
  const [defaultPickerOpen, setDefaultPickerOpen] = useState(false);

  const artistLangCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allArtists) {
      if (a.language) counts[a.language] = (counts[a.language] ?? 0) + 1;
    }
    return counts;
  }, [allArtists]);

  const artistLangOptions = useMemo(() =>
    CIP_LANGUAGES
      .filter(l => (artistLangCounts[l.value] ?? 0) > 0)
      .map(l => ({ ...l, count: artistLangCounts[l.value] ?? 0 }))
      .sort((a, b) => b.count - a.count),
  [artistLangCounts]);

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
      <div className="px-4 py-4 border-b border-white/5 shrink-0">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          aria-label={t('goHome')}
        >
          <img src="/FE_logo_1d.png" alt="Logo" className="w-8 h-8 rounded-full object-cover" />
          <p className="text-white font-bold text-sm tracking-tight">{t('appName')}</p>
        </button>
      </div>

      {/* Tab switcher */}
      <div className="px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {(['songs', 'artists'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === tab ? 'bg-white/15 text-white' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {tab === 'songs' ? t('tabSongs') : t('tabArtists')}
            </button>
          ))}
        </div>
      </div>

      {/* Library Section — songs only */}
      {activeTab === 'artists' && (
        <>
          {/* Artist search */}
          <div className="px-3 py-3 border-b border-white/5 shrink-0">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5" aria-hidden>
                <svg className="h-3 w-3 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="search"
                value={artistQuery}
                onChange={e => onArtistQueryChange(e.target.value)}
                placeholder={t('searchArtistsPlaceholder')}
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-7 pr-3 py-1.5 text-xs text-white
                  placeholder-stone-600 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          {/* Artist count */}
          <div className="flex items-center justify-between px-5 py-3 bg-white/2 shrink-0">
            <p className="text-stone-500 text-xs tabular-nums">
              <span className="text-white font-semibold">{filteredArtistCount}</span>
              <span className="text-stone-600"> / {allArtists.length}</span>
            </p>
            {(artistQuery || artistLanguage) && (
              <button
                onClick={() => { onArtistQueryChange(''); onArtistLanguageChange(''); }}
                className="text-xs text-stone-500 hover:text-white transition-colors underline underline-offset-4"
              >{t('clear')}</button>
            )}
          </div>

          {/* Artist language filter */}
          <div className="flex-1 py-4 overflow-y-auto thin-scrollbar">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">{t('language')}</p>
            <div className="px-2">
              <PillList
                options={artistLangOptions}
                value={artistLanguage}
                onChange={(v) => { onArtistLanguageChange(v); if (v) onClose?.(); }}
                expandLabel={t('moreLanguages')}
                allCount={allArtists.length}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'songs' && <>{/* Count + clear */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/2">
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
          <div className="flex items-center px-5 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 flex-1">{t('languages')}</p>
            <button
              onClick={() => setDefaultPickerOpen(o => !o)}
              aria-label={t('setDefaultLanguage')}
              title={defaultLanguage ? t('defaultLanguageTitle', { language: defaultLanguage }) : t('setDefaultLanguage')}
              className={`p-1 rounded transition-colors ${defaultLanguage ? 'text-emerald-400 hover:text-emerald-300' : 'text-stone-600 hover:text-stone-400'}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          {defaultPickerOpen && (
            <div className="mx-2 mb-3 rounded-lg overflow-hidden border border-white/10 bg-white/3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-600 px-3 pt-2 pb-1">{t('opensWith')}</p>
              <div className="max-h-44 overflow-y-auto thin-scrollbar pb-1">
                <button
                  onClick={() => { onSetDefaultLanguage(''); setDefaultPickerOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${!defaultLanguage ? 'text-white' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
                >
                  {!defaultLanguage
                    ? <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    : <span className="w-3 h-3 shrink-0" />
                  }
                  {t('allLanguages')}
                </button>
                {CIP_LANGUAGES.map(l => (
                  <button
                    key={l.value}
                    onClick={() => { onSetDefaultLanguage(l.value); setDefaultPickerOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${defaultLanguage === l.value ? 'text-white' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {defaultLanguage === l.value
                      ? <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      : <span className="w-3 h-3 shrink-0" />
                    }
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="px-2">
            <PillList
              options={langOptions}
              value={filters.language}
              onChange={(v) => { updateFilters({ language: v, artist_id: '' }); if (v) onClose?.(); }}
              expandLabel={t('otherLanguages')}
              allCount={allSongs.length}
            />
          </div>
        </div>
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">
            {t('artists')}
            {filters.language && (
              <span className="ml-1 text-stone-700 normal-case font-normal tracking-normal">
                {t('languageFilterLabel', { language: filters.language })}
              </span>
            )}
          </p>
          <div className="px-2">
            {artistOptions.length > 0 ? (
              <PillList
                options={artistOptions}
                value={artistFilter}
                onChange={(v) => { setArtistFilter(v); if (v) onClose?.(); }}
                expandLabel={t('moreArtists')}
                allCount={artistPool.length}
              />
            ) : (
              <p className="text-stone-700 text-xs px-3 italic">{t('noArtistsYet')}</p>
            )}
          </div>
        </div>
        {recordingTypeOptions.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-5">{t('format')}</p>
            <div className="px-2">
              <PillList
                options={recordingTypeOptions}
                value={filters.recording_type}
                onChange={(v) => set('recording_type', v)}
                expandLabel={t('moreTypes')}
                allCount={allSongs.filter(s => !!s.recording_type).length}
              />
            </div>
          </div>
        )}
      </div>
      </>}

      {/* User profile — bottom */}
      <div className="px-4 py-3 border-t border-white/5 shrink-0 flex items-center">
        <UserProfile variant="sidebar" />
      </div>
    </aside>
  );
}
