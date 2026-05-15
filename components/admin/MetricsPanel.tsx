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
      <span className="text-xs text-stone-600 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-stone-400 w-24 text-right">
        {filled} / {total}
        <span className="ml-1 text-stone-300">({pct}%)</span>
      </span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  candidate:       'bg-stone-100 text-stone-600',
  needs_review:    'bg-amber-100 text-amber-700',
  checked:         'bg-blue-100 text-blue-700',
  approved_public: 'bg-emerald-100 text-emerald-700',
  approved_private:'bg-teal-100 text-teal-700',
  rejected:        'bg-red-100 text-red-600',
  duplicate:       'bg-purple-100 text-purple-600',
};

const STATUS_LABEL: Record<string, string> = {
  candidate:       'Candidate',
  needs_review:    'Needs review',
  checked:         'Checked',
  approved_public: 'Approved (public)',
  approved_private:'Approved (private)',
  rejected:        'Rejected',
  duplicate:       'Duplicate',
};

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => r.json())
      .then(data => { setMetrics(data); setLoading(false); })
      .catch(() => { setError('Failed to load metrics'); setLoading(false); });
  }, []);

  if (loading) return <p className="text-stone-400 text-sm p-6">Loading…</p>;
  if (error)   return <p className="text-red-400 text-sm p-6">{error}</p>;
  if (!metrics) return null;

  const { total, gaps, verification, lyrics } = metrics;

  return (
    <div className="flex flex-col gap-8 max-w-2xl p-6">
      <div>
        <h2 className="text-white font-bold text-lg mb-0.5">Catalog Metrics</h2>
        <p className="text-stone-500 text-xs">{total} songs in database</p>
      </div>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Metadata Completeness</p>
        <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col gap-3.5">
          <GapBar label="Language"      missing={gaps.no_language}     total={total} />
          <GapBar label="Ethnic group"  missing={gaps.no_ethnic_group}  total={total} />
          <GapBar label="Year"          missing={gaps.no_year}          total={total} />
          <GapBar label="Genre"         missing={gaps.no_genre}         total={total} />
          <GapBar label="Chinese title" missing={gaps.no_title_zh}      total={total} />
          <GapBar label="Artist linked" missing={gaps.no_artist_link}   total={total} />
          <GapBar label="Has lyrics"    missing={gaps.no_lyrics}        total={total} />
        </div>
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">Verification Status</p>
        <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-wrap gap-2">
          {Object.entries(verification)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div
                key={status}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status] ?? 'bg-stone-100 text-stone-600'}`}
              >
                <span>{STATUS_LABEL[status] ?? status}</span>
                <span className="opacity-60 font-bold">{count}</span>
              </div>
            ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-3">
          Lyrics
          <span className="ml-1 normal-case font-normal tracking-normal text-stone-400">— {lyrics.total} songs have a lyrics row</span>
        </p>
        {lyrics.total > 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col gap-3.5">
            <GapBar label="Public"           missing={lyrics.not_public}       total={lyrics.total} />
            <GapBar label="Original text"    missing={lyrics.missing_original}  total={lyrics.total} />
            <GapBar label="Chinese transl."  missing={lyrics.missing_zh}        total={lyrics.total} />
            <GapBar label="English transl."  missing={lyrics.missing_en}        total={lyrics.total} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-stone-400 text-xs">No lyrics data yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
