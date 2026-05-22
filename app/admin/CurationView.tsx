'use client';

import { useState, useEffect } from 'react';
import type { Song } from '@/lib/types';
import SongsAdminView from '@/components/admin/SongsAdminView';
import ArtistsAdminView from '@/components/admin/ArtistsAdminView';
import MetricsPanel from '@/components/admin/MetricsPanel';
import { signOut } from './actions';

type Tab = 'metrics' | 'songs' | 'artists';

export type AdminFilters = {
  language: string;
  verification_status: string;
  artist: string;
  missing_field: string;
  ethnic_group: string;
  artist_missing_field: string;
};

const EMPTY_FILTERS: AdminFilters = { language: '', verification_status: '', artist: '', missing_field: 'any_core', ethnic_group: '', artist_missing_field: 'any_except_songs' };

const MISSING_FIELDS = ['any', 'any_core', 'language', 'ethnic_group', 'no_artist', 'no_url', 'lyrics', 'lyrics_unapproved'];
const MISSING_LABELS: Record<string, string> = {
  any:              'Any missing',
  any_core:         'Any missing*',
  language:         'No language',
  ethnic_group:     'No ethnic group',
  no_artist:        'No artist',
  no_url:           'No URL',
  lyrics:           'No lyrics',
  lyrics_unapproved:'Lyrics unapproved',
};

const ARTIST_MISSING_FIELDS = ['any', 'any_except_songs', 'no_bio', 'no_ethnic_group', 'no_language', 'no_active_years', 'no_links', 'no_linked_songs'];
const ARTIST_MISSING_LABELS: Record<string, string> = {
  any:              'Any missing',
  any_except_songs: 'Any missing*',
  no_bio:           'No bio',
  no_ethnic_group:  'No ethnic group',
  no_language:      'No language',
  no_active_years:  'No active years',
  no_links:         'No links',
  no_linked_songs:  'No songs',
};

const LANGUAGES = [
  'Amis', 'Atayal', 'Paiwan', 'Bunun', 'Puyuma', 'Rukai', 'Tsou',
  'Saisiyat', 'Tao (Yami)', 'Thao', 'Kavalan', 'Truku', 'Sakizaya',
  'Seediq', "Hla'alua", 'Kanakanavu',
];

const ETHNIC_GROUPS = LANGUAGES; // same 16 groups

const VERIFICATION_STATUSES = [
  'candidate', 'needs_review', 'checked', 'approved_public', 'approved_private', 'rejected', 'duplicate',
];

function FilterSelect({ label, value, onChange, options, optionLabels }: Readonly<{
  label: string; value: string; onChange: (v: string) => void; options: string[];
  optionLabels?: Record<string, string>;
}>) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-stone-400 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-32 text-xs rounded-md border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-400 transition-colors ${
          value
            ? 'bg-stone-800 border-stone-600 text-white'
            : 'bg-stone-100 border-stone-200 text-stone-600'
        }`}
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </div>
  );
}

function FilterIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 3h13a.5.5 0 0 1 .35.85L10 9.71V14a.5.5 0 0 1-.78.41l-3-2A.5.5 0 0 1 6 12V9.71L1.15 3.85A.5.5 0 0 1 1.5 3z"/>
    </svg>
  );
}

// songs prop kept for ISR compatibility with the admin page — not used internally
export default function CurationView(_: { songs: Song[] }) {
  const [tab, setTab]                 = useState<Tab>('metrics');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters]         = useState<AdminFilters>(EMPTY_FILTERS);
  const [artistOptions, setArtistOptions] = useState<string[]>([]);
  const [unlinkedCount, setUnlinkedCount] = useState(0);

  const setFilter = <K extends keyof AdminFilters>(key: K, value: string) =>
    setFilters(f => ({ ...f, [key]: value }));

  useEffect(() => {
    fetch('/api/admin/unlinked-artists')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUnlinkedCount(data.length); })
      .catch(() => {});
  }, []);

  // Load artist options whenever language or status filter changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.language)            params.set('language',            filters.language);
    if (filters.verification_status) params.set('verification_status', filters.verification_status);
    const qs = params.toString();
    fetch(`/api/admin/artist-options${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setArtistOptions(data); })
      .catch(() => {});
  }, [filters.language, filters.verification_status]);

  const hasActiveFilter = Object.values(filters).some(Boolean);

  return (
    <div className="h-screen overflow-hidden bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-stone-200 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 tracking-tight">
              Formosan Echoes{' '}<span className="text-xs font-normal text-stone-400 ml-2">台灣原住民音樂索引</span>
            </h1>
            <p className="text-xs text-stone-400 hidden sm:block">Formosan-language song metadata browser · all entries are candidates unless verified</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-2 py-1 rounded hover:bg-stone-100"
              >
                Sign out
              </button>
            </form>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              title="Toggle filters"
              className={`relative p-2 rounded-lg transition-colors ${
                filtersOpen
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'
              }`}
            >
              <FilterIcon className="w-4 h-4" />
            </button>
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {(['metrics', 'songs', 'artists'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${
                    tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {{ metrics: 'Metrics', songs: 'Songs', artists: 'Artists' }[t]}
                  {t === 'artists' && unlinkedCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                      {unlinkedCount > 9 ? '9+' : unlinkedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="shrink-0 bg-white border-b border-stone-200 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-4 flex-wrap">
            {(tab === 'metrics' || tab === 'songs') && <>
              <FilterSelect label="Language" value={filters.language}            onChange={v => setFilter('language', v)}            options={LANGUAGES} />
              <FilterSelect label="Artist"   value={filters.artist}              onChange={v => setFilter('artist', v)}              options={artistOptions} />
              <FilterSelect label="Status"   value={filters.verification_status} onChange={v => setFilter('verification_status', v)} options={VERIFICATION_STATUSES} />
            </>}
            {tab === 'songs' && (
              <FilterSelect label="Missing" value={filters.missing_field} onChange={v => setFilter('missing_field', v)} options={MISSING_FIELDS} optionLabels={MISSING_LABELS} />
            )}
            {tab === 'artists' && <>
              <FilterSelect label="Ethnic group" value={filters.ethnic_group}         onChange={v => setFilter('ethnic_group', v)}         options={ETHNIC_GROUPS} />
              <FilterSelect label="Missing"      value={filters.artist_missing_field} onChange={v => setFilter('artist_missing_field', v)} options={ARTIST_MISSING_FIELDS} optionLabels={ARTIST_MISSING_LABELS} />
            </>}
            {hasActiveFilter && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-[10px] text-stone-400 hover:text-stone-700 transition-colors ml-auto"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <main className={`flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 ${
        tab === 'songs' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}>

        {tab === 'metrics' && (
          <div className="bg-[#0f0f16] rounded-xl border border-white/10">
            <MetricsPanel filters={filters} />
          </div>
        )}

        {tab === 'songs' && <SongsAdminView filters={filters} />}

        {tab === 'artists' && (
          <div className="h-full overflow-hidden">
            <ArtistsAdminView filters={filters} />
          </div>
        )}

      </main>
    </div>
  );
}
