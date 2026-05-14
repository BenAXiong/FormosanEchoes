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
 * Uses artist_ids if present; falls back to alias matching for unlinked songs.
 */
export function getArtistsWithSongs(songs: Song[]): Artist[] {
  const artistIdsWithSongs = new Set<string>();
  const aliasMap = buildAliasMap();

  for (const song of songs) {
    // Prefer explicit artist_ids links
    if (song.artist_ids && song.artist_ids.length > 0) {
      for (const id of song.artist_ids) artistIdsWithSongs.add(id);
      continue;
    }
    // Fall back to alias matching for unlinked songs
    if (song.artist) {
      const lower = song.artist.toLowerCase().trim();
      // Try full string, then tokens
      let id = aliasMap.get(lower);
      if (!id) {
        const tokens = lower.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 2);
        for (const token of tokens) {
          id = aliasMap.get(token);
          if (id) break;
        }
      }
      if (!id) {
        for (const [alias, aid] of aliasMap) {
          if (alias.length > 2 && lower.includes(alias)) { id = aid; break; }
        }
      }
      if (id) artistIdsWithSongs.add(id);
    }
  }

  return allArtists
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
