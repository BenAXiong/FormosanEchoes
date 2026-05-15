import type { Artist, Song } from '@/lib/types';
import rawArtists from '@/data/artists.json';

// Cast the JSON import to the full Artist type
export const allArtists: Artist[] = rawArtists as Artist[];

// Build a map for fast ID lookups
const artistById = new Map<string, Artist>(allArtists.map(a => [a.id, a]));

/** Get a single artist by ID */
export function getArtistById(id: string): Artist | undefined {
  return artistById.get(id);
}

/**
 * Build alias → artist_id map for runtime name resolution.
 * Used by the sidebar to match song.artist strings when artist_ids is not yet set.
 */
export function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of allArtists) {
    const aliases = [
      a.name_display,
      ...a.names_zh,
      ...a.names_rom,
      ...a.names_indigenous,
    ].filter(Boolean);
    for (const alias of aliases) {
      map.set(alias.toLowerCase().trim(), a.id);
    }
  }
  return map;
}

/**
 * Given a list of songs, return the subset of artists who have ≥1 linked song.
 * Only uses artist_ids — intentionally no alias fallback, so the sidebar only
 * shows artists whose filter will actually return results.
 * Pass a runtime `artists` array (e.g. from Supabase) to override the static JSON pool.
 */
export function getArtistsWithSongs(songs: Song[], artists: Artist[] = allArtists): Artist[] {
  const artistIdsWithSongs = new Set<string>();

  for (const song of songs) {
    for (const id of song.artist_ids ?? []) {
      artistIdsWithSongs.add(id);
    }
  }

  return artists
    .filter(a => artistIdsWithSongs.has(a.id))
    .sort((a, b) => a.name_display.localeCompare(b.name_display, 'zh'));
}

/**
 * Returns the count of songs linked to a specific artist.
 */
export function getSongCountForArtist(artistId: string, songs: Song[]): number {
  return songs.filter(s =>
    (s.artist_ids ?? []).includes(artistId)
  ).length;
}
