'use client';
import { useEffect, useState } from 'react';

type Metrics = {
  total: number;
  gaps: {
    no_language: number;
    no_ethnic_group: number;
    no_year: number;
    no_genre: number;
    no_title_zh: number;
    no_artist_link: number;
    no_lyrics: number;
  };
  verification: Record<string, number>;
  lyrics: {
    total: number;
    not_public: number;
    missing_original: number;
    missing_zh: number;
    missing_en: number;
  };
};

function GapBar({ label, missing, total }: { label: string; missing: number; total: number }) {
  const filled = total - missing;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const bar = pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-500 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-stone-500 w-20 text-right">
        {filled}/{total}
        <span className="ml-1 text-stone-600">({pct}%)</span>
      </span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  candidate:        'bg-stone-700/60 text-stone-300',
  needs_review:     'bg-amber-500/20 text-amber-400',
  checked:          'bg-blue-500/20 text-blue-400',
  approved_public:  'bg-emerald-500/20 text-emerald-400',
  approved_private: 'bg-teal-500/20 text-teal-400',
  rejected:         'bg-red-500/20 text-red-400',
  duplicate:        'bg-purple-500/20 text-purple-400',
};

const STATUS_LABEL: Record<string, string> = {
  candidate:        'Candidate',
  needs_review:     'Needs review',
  checked:          'Checked',
  approved_public:  'Approved (public)',
  approved_private: 'Approved (private)',
  rejected:         'Rejected',
  duplicate:        'Duplicate',
};

type Filters = { language: string; verification_status: string; artist: string; missing_field: string };

export default function MetricsPanel({ filters }: Readonly<{ filters?: Filters }>) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const language            = filters?.language            ?? '';
  const verification_status = filters?.verification_status ?? '';
  const artist              = filters?.artist              ?? '';
  const missing_field       = filters?.missing_field       ?? '';

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (language)            params.set('language',            language);
    if (verification_status) params.set('verification_status', verification_status);
    if (artist)              params.set('artist',              artist);
    if (missing_field)       params.set('missing_field',       missing_field);
    const qs = params.toString();
    fetch(`/api/admin/metrics${qs ? `?${qs}` : ''}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then(data => { setMetrics(data); setLoading(false); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
        setLoading(false);
      });
  }, [language, verification_status, artist, missing_field]);

  if (loading) return <p className="text-stone-500 text-sm p-6">Loading…</p>;
  if (error)   return <p className="text-red-400 text-sm p-6">{error}</p>;
  if (!metrics) return null;

  const { total, gaps, verification, lyrics } = metrics;

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

      {/* Left: metadata */}
      <section className="flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Metadata completeness
          <span className="ml-2 normal-case font-normal tracking-normal text-stone-600">{total} songs</span>
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3.5">
          <GapBar label="Language"      missing={gaps.no_language}    total={total} />
          <GapBar label="Ethnic group"  missing={gaps.no_ethnic_group} total={total} />
          <GapBar label="Year"          missing={gaps.no_year}         total={total} />
          <GapBar label="Genre"         missing={gaps.no_genre}        total={total} />
          <GapBar label="Chinese title" missing={gaps.no_title_zh}     total={total} />
          <GapBar label="Artist linked" missing={gaps.no_artist_link}  total={total} />
          <GapBar label="Has lyrics"    missing={gaps.no_lyrics}       total={total} />
        </div>
      </section>

      {/* Right: verification + lyrics */}
      <div className="flex flex-col gap-8">

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Verification status</p>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-wrap gap-2">
            {Object.entries(verification)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div
                  key={status}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] ?? 'bg-stone-700/60 text-stone-300'}`}
                >
                  <span>{STATUS_LABEL[status] ?? status}</span>
                  <span className="opacity-60 font-bold">{count}</span>
                </div>
              ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Lyrics
            <span className="ml-2 normal-case font-normal tracking-normal text-stone-600">
              {lyrics.total} songs have a lyrics row
            </span>
          </p>
          {lyrics.total > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3.5">
              <GapBar label="Public"          missing={lyrics.not_public}      total={lyrics.total} />
              <GapBar label="Original text"   missing={lyrics.missing_original} total={lyrics.total} />
              <GapBar label="Chinese transl." missing={lyrics.missing_zh}       total={lyrics.total} />
              <GapBar label="English transl." missing={lyrics.missing_en}       total={lyrics.total} />
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-stone-600 text-xs">No lyrics data yet.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
