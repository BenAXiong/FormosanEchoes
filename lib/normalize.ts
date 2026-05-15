import type { Song } from './types';

/** Safely return a lowercase string for a field, or empty string if missing. */
function safe(val: unknown): string {
  if (typeof val === 'string') return val.toLowerCase();
  if (typeof val === 'number') return String(val);
  return '';
}

/** Normalize a song — fill in defaults for missing optional fields. */
export function normalizeSong(raw: Partial<Song>): Song {
  return {
    id: raw.id ?? `sof-unknown-${raw.title_original?.length ?? 0}`,
    title_original: raw.title_original ?? undefined,
    title_romanized: raw.title_romanized ?? undefined,
    title_chinese: raw.title_chinese ?? undefined,
    artist: raw.artist ?? undefined,
    language_claimed: raw.language_claimed ?? undefined,
    language_evidence: raw.language_evidence ?? undefined,
    ethnic_group_claimed: raw.ethnic_group_claimed ?? undefined,
    ethnic_group_evidence: raw.ethnic_group_evidence ?? undefined,
    performers: raw.performers ?? undefined,
    source_platform: raw.source_platform ?? undefined,
    url: raw.url ?? undefined,
    youtube_url: raw.youtube_url ?? undefined,
    lyrics_url: raw.lyrics_url ?? undefined,
    album_or_source: raw.album_or_source ?? undefined,
    year: raw.year ?? undefined,
    location_claimed: raw.location_claimed ?? undefined,
    region: raw.region ?? undefined,
    genre: raw.genre ?? undefined,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    source_snippets: raw.source_snippets ?? undefined,
    verification_notes: raw.verification_notes ?? undefined,
    confidence: raw.confidence ?? 'unknown',
    verification_status: raw.verification_status ?? 'candidate',
    needs_manual_verification: raw.needs_manual_verification ?? true,
    checked_by_me: raw.checked_by_me ?? false,
    date_added: raw.date_added ?? undefined,
    lyrics: raw.lyrics ?? undefined,
  };
}

/** Get a display title for a song — falls back gracefully. */
export function getDisplayTitle(song: Song): string {
  return song.title_original ?? song.title_romanized ?? song.title_chinese ?? '(Untitled)';
}

/** Get a secondary title line (romanized or Chinese), different from the primary. */
export function getSecondaryTitle(song: Song): string | null {
  if (song.title_original) {
    return song.title_romanized ?? song.title_chinese ?? null;
  }
  if (song.title_romanized) return song.title_chinese ?? null;
  return null;
}

/** Check if a song has a valid YouTube URL. */
export function isYouTubeUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

/** Extract YouTube video ID from a URL. */
export function getYouTubeId(url: string): string | null {
  const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

/** Build a searchable text blob from all relevant song fields. */
export function buildSearchText(song: Song): string {
  return [
    safe(song.title_original),
    safe(song.title_romanized),
    safe(song.title_chinese),
    safe(song.artist),
    safe(song.language_claimed),
    safe(song.ethnic_group_claimed),
    safe(song.region),
    safe(song.genre),
    safe(song.album_or_source),
    safe(song.verification_notes),
    safe(song.source_snippets),
    ...(song.tags ?? []).map(safe),
  ].join(' ');
}

/** Extract start time in seconds from YouTube URL if present. */
export function getYouTubeStartTime(url: string): number | null {
  const tMatch = url.match(/[?&]t=([^&]+)/);
  if (!tMatch) return null;
  const tStr = tMatch[1];
  
  if (/^\d+s?$/.test(tStr)) return parseInt(tStr, 10);
  
  let seconds = 0;
  const hMatch = tStr.match(/(\d+)h/);
  const mMatch = tStr.match(/(\d+)m/);
  const sMatch = tStr.match(/(\d+)s/);
  if (hMatch) seconds += parseInt(hMatch[1], 10) * 3600;
  if (mMatch) seconds += parseInt(mMatch[1], 10) * 60;
  if (sMatch) seconds += parseInt(sMatch[1], 10);
  
  return seconds > 0 ? seconds : null;
}
