'use client';
import { useEffect, useState } from 'react';

type Metrics = {
  songs: {
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
  };
  lyrics: {
    public: number;
    private_content: number;
    searched_na: number;
    total: number;
    missing_original: number;
    missing_zh: number;
    missing_en: number;
    na: {
      not_public: number;
      missing_original: number;
      missing_zh: number;
      missing_en: number;
    };
  };
  artists: {
    total: number;
    no_songs: number;
    gaps: {
      no_bio: number;
      no_ethnic_group: number;
      no_language: number;
      no_active_years: number;
      no_links: number;
      no_photo: number;
    };
    na: {
      no_bio: number;
      no_ethnic_group: number;
      no_language: number;
      no_active_years: number;
      no_links: number;
      no_songs: number;
    };
  };
};

type Filters = { language: string; verification_status: string; artist: string; missing_field: string };
type Segment = { value: number; color: string; label: string };

const VER_SEGMENTS: Array<{ key: string; label: string; color: string }> = [
  { key: 'approved_public',  label: 'Approved (public)',  color: '#34d399' },
  { key: 'approved_private', label: 'Approved (private)', color: '#2dd4bf' },
  { key: 'checked',          label: 'Checked',            color: '#60a5fa' },
  { key: 'needs_review',     label: 'Needs review',       color: '#fbbf24' },
  { key: 'candidate',        label: 'Candidate',          color: '#78716c' },
  { key: 'duplicate',        label: 'Duplicate',          color: '#c084fc' },
  { key: 'rejected',         label: 'Rejected',           color: '#f87171' },
];

function SegmentedRing({ segments, size, centerValue, centerSublabel }: Readonly<{
  segments: Segment[];
  size: number;
  centerValue: number | string;
  centerSublabel?: string;
}>) {
  const sw = Math.round(size * 14 / 90);
  const r = (size - sw) / 2;
  const ctr = size / 2;
  const circ = 2 * Math.PI * r;
  const segTotal = segments.reduce((acc, s) => acc + s.value, 0);
  const activeCount = segments.filter(s => s.value > 0).length;
  const GAP = activeCount > 1 ? 2 : 0;

  let cumLen = 0;
  const arcs = segments
    .filter(s => s.value > 0)
    .map(s => {
      const fullLen = segTotal > 0 ? (s.value / segTotal) * circ : 0;
      const arc = { ...s, drawLen: Math.max(0, fullLen - GAP), offset: cumLen };
      cumLen += fullLen;
      return arc;
    });

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
          <circle cx={ctr} cy={ctr} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
          {arcs.map(arc => (
            <circle
              key={arc.label}
              cx={ctr} cy={ctr} r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={sw}
              strokeDasharray={arc.drawLen + ' ' + (circ - arc.drawLen)}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none leading-tight">
          <span className="text-2xl font-bold text-white tabular-nums">{centerValue}</span>
          {centerSublabel && <span className="text-[10px] text-stone-500 mt-0.5">{centerSublabel}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1 w-full">
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-stone-400 flex-1">{s.label}</span>
            <span className="text-[10px] text-stone-600 tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-400';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

function GapBar({ label, missing, total, naCount = 0 }: Readonly<{
  label: string; missing: number; total: number; naCount?: number;
}>) {
  const filled = total - missing;
  const safeNA = Math.min(naCount, missing);
  const filledPct = total > 0 ? (filled / total) * 100 : 0;
  const naPct = total > 0 ? (safeNA / total) * 100 : 0;
  const displayPct = Math.round(filledPct);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-500 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
        <div className={'absolute inset-y-0 left-0 ' + barColor(displayPct)} style={{ width: filledPct + '%' }} />
        {safeNA > 0 && <div className="absolute inset-y-0 bg-violet-500/50" style={{ left: filledPct + '%', width: naPct + '%' }} />}
      </div>
      <span className="text-xs tabular-nums text-stone-500 w-20 text-right">{filled}/{total}<span className="ml-1 text-stone-600">({displayPct}%)</span></span>
    </div>
  );
}

export default function MetricsPanel({ filters }: Readonly<{ filters?: Filters }>) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoreSongs, setShowMoreSongs] = useState(false);

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
    const url = qs ? `/api/admin/metrics?${qs}` : '/api/admin/metrics';
    fetch(url)
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

  const { songs, lyrics, artists } = metrics;
  const artistsLinked = artists.total - artists.no_songs;

  const songSegments: Segment[] = VER_SEGMENTS.map(vs => ({
    value: songs.verification[vs.key] ?? 0,
    color: vs.color,
    label: vs.label,
  }));

  const lyricsSegments: Segment[] = [
    { value: lyrics.public,          color: '#34d399', label: 'Public' },
    { value: lyrics.private_content, color: '#60a5fa', label: 'Private (has content)' },
    { value: lyrics.searched_na,     color: '#78716c', label: 'Searched, not found' },
  ];

  const artistSegments: Segment[] = [
    { value: artistsLinked,    color: '#a78bfa', label: 'With songs' },
    { value: artists.no_songs, color: '#f87171', label: 'No linked songs' },
  ];

  return (
    <div className="p-6 flex flex-col gap-8">

      {/* Row 1 — segmented ring charts */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-start justify-around gap-6">
        <div className="flex flex-col items-center gap-2" style={{ maxWidth: 170 }}>
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Songs</p>
          <SegmentedRing segments={songSegments} size={135} centerValue={songs.total} centerSublabel="total" />
        </div>
        <div className="w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-2" style={{ maxWidth: 170 }}>
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Lyrics</p>
          <SegmentedRing segments={lyricsSegments} size={135} centerValue={lyrics.public} centerSublabel="public" />
        </div>
        <div className="w-px self-stretch bg-white/10" />
        <div className="flex flex-col items-center gap-2" style={{ maxWidth: 170 }}>
          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Artists</p>
          <SegmentedRing segments={artistSegments} size={135} centerValue={artistsLinked} centerSublabel="linked" />
        </div>
      </div>

      {/* Row 2 — songs + artists columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Songs column */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Songs<span className="ml-2 normal-case font-normal tracking-normal text-stone-600">{songs.total} total</span>{songs.gaps.no_artist_link > 0 && <span className="ml-3 text-amber-500 font-semibold normal-case tracking-normal">⚠ {songs.gaps.no_artist_link} unlinked</span>}</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4">

            {/* Metadata */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">Metadata</p>
              <GapBar label="Artist linked"  missing={songs.gaps.no_artist_link}  total={songs.total} />
              <GapBar label="Language"       missing={songs.gaps.no_language}     total={songs.total} />
              <GapBar label="Chinese title"  missing={songs.gaps.no_title_zh}     total={songs.total} />
              <GapBar label="Has lyrics"     missing={songs.gaps.no_lyrics}       total={songs.total} />
              <button
                type="button"
                onClick={() => setShowMoreSongs(v => !v)}
                className="text-[10px] text-stone-600 hover:text-stone-400 transition-colors flex items-center gap-1 mt-0.5"
              ><span>{showMoreSongs ? '▴' : '▾'}</span><span>{showMoreSongs ? 'Less' : 'More details'}</span></button>
              {showMoreSongs && (
                <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
                  <GapBar label="Genre"        missing={songs.gaps.no_genre}        total={songs.total} />
                  <GapBar label="Ethnic group" missing={songs.gaps.no_ethnic_group} total={songs.total} />
                  <GapBar label="Year"         missing={songs.gaps.no_year}         total={songs.total} />
                </div>
              )}
            </div>

            {/* Lyrics quality (only when songs have lyrics rows) */}
            {lyrics.total > 0 && (
              <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
                <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">Lyrics</p>
                <GapBar label="Public"          missing={lyrics.total - lyrics.public}  total={lyrics.total} naCount={lyrics.na.not_public} />
                <GapBar label="Original text"   missing={lyrics.missing_original}       total={lyrics.total} naCount={lyrics.na.missing_original} />
                <GapBar label="Chinese transl." missing={lyrics.missing_zh}             total={lyrics.total} naCount={lyrics.na.missing_zh} />
                <GapBar label="English transl." missing={lyrics.missing_en}             total={lyrics.total} naCount={lyrics.na.missing_en} />
              </div>
            )}
          </div>
        </section>

        {/* Artists column */}
        <section className="flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Artists<span className="ml-2 normal-case font-normal tracking-normal text-stone-600">{artists.total} total</span>{artists.no_songs > 0 && <span className="ml-3 text-amber-500 font-semibold normal-case tracking-normal">⚠ {artists.no_songs} unlinked</span>}</p>

          {artists.total > 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-3.5">
              <p className="text-[10px] font-semibold text-stone-600 uppercase tracking-wider">Metadata</p>
              <GapBar label="Has songs"    missing={artists.no_songs}             total={artists.total} naCount={artists.na.no_songs} />
              <GapBar label="Bio"          missing={artists.gaps.no_bio}          total={artists.total} naCount={artists.na.no_bio} />
              <GapBar label="Ethnic group" missing={artists.gaps.no_ethnic_group} total={artists.total} naCount={artists.na.no_ethnic_group} />
              <GapBar label="Language"     missing={artists.gaps.no_language}     total={artists.total} naCount={artists.na.no_language} />
              <GapBar label="Active years" missing={artists.gaps.no_active_years} total={artists.total} naCount={artists.na.no_active_years} />
              <GapBar label="Links"        missing={artists.gaps.no_links}        total={artists.total} naCount={artists.na.no_links} />
              <GapBar label="Photo"        missing={artists.gaps.no_photo}        total={artists.total} />
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-stone-600 text-xs">No artists yet.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
