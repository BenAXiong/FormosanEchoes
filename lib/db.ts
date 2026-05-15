/**
 * Server-side data access. Maps Supabase rows to existing Song/Artist types.
 * Never import this in client components.
 */
import { createServerClient } from './supabase';
import type { Song, Artist, LyricsData, VerificationStatus } from './types';

// ── Row types from Supabase ───────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// ── Mappers ──────────────────────────────────────────────────

function mapLyrics(row: Row, songId: string): LyricsData {
  return {
    song_id:               songId,
    lyrics_original:       row.lyrics_original       ?? undefined,
    lyrics_romanized:      undefined,
    lyrics_translation_zh: row.lyrics_zh             ?? undefined,
    lyrics_translation_en: row.lyrics_en             ?? undefined,
    lyrics_source:         row.source                ?? undefined,
    lyrics_rights_status:  undefined,
    lyrics_notes:          undefined,
    has_permission:        row.show_publicly          ?? false,
    show_publicly:         row.show_publicly          ?? false,
  };
}

function mapSong(row: Row): Song {
  const tags = (row.song_tags ?? [])
    .map((st: Row) => st.tags?.value as string)
    .filter(Boolean);

  const artist_ids = (row.song_artists ?? [])
    .map((sa: Row) => sa.artist_id as string)
    .filter(Boolean);

  return {
    id:                       row.id,
    title_original:           row.title_original       ?? undefined,
    title_romanized:          undefined,
    title_chinese:            row.title_zh             ?? undefined,
    artist:                   row.artist_credit        ?? undefined,
    language_claimed:         row.language             ?? undefined,
    language_evidence:        undefined,
    ethnic_group_claimed:     row.ethnic_group         ?? undefined,
    ethnic_group_evidence:    undefined,
    performers:               undefined,
    source_platform:          undefined,
    url:                      row.url                  ?? undefined,
    youtube_url:              row.yt_url               ?? undefined,
    lyrics_url:               undefined,
    album_or_source:          row.album                ?? undefined,
    year:                     row.year                 ?? undefined,
    location_claimed:         row.location             ?? undefined,
    region:                   row.region               ?? undefined,
    genre:                    row.genre                ?? undefined,
    tags,
    source_snippets:          undefined,
    verification_notes:       row.notes                ?? undefined,
    confidence:               'unknown',
    verification_status:      (row.verification_status as VerificationStatus) ?? 'candidate',
    needs_manual_verification: true,
    checked_by_me:            false,
    date_added:               row.created_at?.split('T')[0] ?? undefined,
    artist_ids,
    lyrics:                   row.lyrics ? mapLyrics(row.lyrics, row.id) : undefined,
  };
}

function mapArtist(row: Row): Artist {
  const names = (row.artist_names ?? []) as Row[];
  return {
    id:              row.id,
    name_display:    row.name_display,
    names_zh:        names.filter(n => n.script === 'zh').map(n => n.name as string),
    names_rom:       names.filter(n => n.script === 'ab').map(n => n.name as string),
    names_indigenous: [],
    zh_surname:      row.zh_surname      ?? null,
    ethnic_group:    row.ethnic_group    ?? null,
    language:        row.language        ?? null,
    is_group:        row.is_group        ?? false,
    active_years:    row.active_years    ?? null,
    bio_zh:          row.bio_zh          ?? null,
    bio_en:          row.bio_en          ?? null,
    notable_works:   [],
    youtube_channel: row.youtube_channel ?? null,
    wikipedia_url:   row.wikipedia_url   ?? null,
    sources:         [],
    notes:           row.notes           ?? null,
  };
}

// ── Public API ────────────────────────────────────────────────

export async function getSongs(): Promise<Song[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('songs')
    .select(`
      *,
      song_artists (artist_id),
      song_tags    (tags (value)),
      lyrics       (*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getSongs: ${error.message}`);
  return (data ?? []).map(mapSong);
}

export async function getArtists(): Promise<Artist[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('artists')
    .select(`*, artist_names (*)`)
    .order('name_display');

  if (error) throw new Error(`getArtists: ${error.message}`);
  return (data ?? []).map(mapArtist);
}
