'use client';

import { useState, useEffect } from 'react';
import type { Song } from '@/lib/types';
import SongsAdminView from '@/components/admin/SongsAdminView';
import ArtistsAdminView from '@/components/admin/ArtistsAdminView';
import MetricsPanel from '@/components/admin/MetricsPanel';
import { signOut } from './actions';

type Tab = 'metrics' | 'songs' | 'artists' | 'live' | 'analytics';

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
  const [drawerOpen, setDrawerOpen]   = useState(false);
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
        {/* Mobile header */}
        <div className="lg:hidden px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold text-stone-800 tracking-tight">
            Echoes <span className="text-xs font-normal text-stone-400 capitalize">{tab}</span>
          </h1>
          <div className="flex items-center gap-1">
            {!['live', 'analytics'].includes(tab) && (
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className={`p-2 rounded-lg transition-colors ${filtersOpen ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500'}`}
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 text-stone-500 hover:text-stone-800 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {/* Desktop header */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 items-center gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-800 tracking-tight">
              Formosan Echoes{' '}<span className="text-xs font-normal text-stone-400 ml-2">台灣原住民音樂索引</span>
            </h1>
            <p className="text-xs text-stone-400">Formosan-language song metadata browser · all entries are candidates unless verified</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={signOut}>
              <button type="submit" className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-2 py-1 rounded hover:bg-stone-100">
                Sign out
              </button>
            </form>
            {!['live', 'analytics'].includes(tab) && (
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className={`relative p-2 rounded-lg transition-colors ${filtersOpen ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700'}`}
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            )}
            <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
              {(['metrics', 'songs', 'artists', 'live', 'analytics'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2 rounded-md text-sm font-semibold transition-colors ${tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {{ metrics: 'Metrics', songs: 'Songs', artists: 'Artists', live: 'Live', analytics: 'Analytics' }[t]}
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

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerOpen(false)} />
          <div className="lg:hidden fixed inset-y-0 right-0 w-64 z-50 bg-white border-l border-stone-200 flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
              <span className="font-semibold text-stone-800 text-sm">Formosan Echoes</span>
              <button onClick={() => setDrawerOpen(false)} className="text-stone-400 hover:text-stone-600 transition-colors text-xl leading-none">✕</button>
            </div>
            <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
              {(['metrics', 'songs', 'artists', 'live', 'analytics'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setDrawerOpen(false); }}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${tab === t ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-800'}`}
                >
                  {{ metrics: 'Metrics', songs: 'Songs', artists: 'Artists', live: 'Live', analytics: 'Analytics' }[t]}
                  {t === 'artists' && unlinkedCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                      {unlinkedCount > 9 ? '9+' : unlinkedCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-stone-200 shrink-0">
              <form action={signOut}>
                <button type="submit" className="w-full text-left px-3 py-2.5 text-sm text-stone-500 hover:text-stone-800 transition-colors rounded-lg hover:bg-stone-50">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Filter bar */}
      {filtersOpen && !['live', 'analytics'].includes(tab) && (
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

      <main className={`flex-1 w-full ${
        ['live', 'analytics'].includes(tab)
          ? 'overflow-hidden'
          : `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${tab === 'songs' ? 'overflow-hidden' : 'overflow-y-auto'}`
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

        {tab === 'live' && (
          process.env.NEXT_PUBLIC_UMAMI_SHARE_URL ? (
            <iframe
              src={process.env.NEXT_PUBLIC_UMAMI_SHARE_URL}
              className="w-full h-full border-0"
              title="Umami live dashboard"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-400">
              <p className="text-sm font-medium">Umami share URL not configured.</p>
              <ol className="text-xs text-stone-500 list-decimal list-inside space-y-1 max-w-sm text-left">
                <li>Go to <strong>app.umami.is</strong> → Websites → your site</li>
                <li>Open the <strong>Share</strong> tab and enable sharing</li>
                <li>Copy the share URL</li>
                <li>Add <code className="bg-stone-100 px-1 rounded">NEXT_PUBLIC_UMAMI_SHARE_URL=&lt;url&gt;</code> to <code className="bg-stone-100 px-1 rounded">.env.local</code> and Vercel env vars</li>
              </ol>
            </div>
          )
        )}

        {tab === 'analytics' && (
          <div className="flex items-center justify-center h-full text-stone-400 text-sm">
            Custom analytics — coming soon
          </div>
        )}

      </main>
    </div>
  );
}
