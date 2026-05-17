import type { Artist, Song } from '@/lib/types';

/**
 * Given a list of songs, return the subset of artists who have ≥1 linked song.
 * Only uses artist_ids — intentionally no alias fallback, so the sidebar only
 * shows artists whose filter will actually return results.
 */
export function getArtistsWithSongs(songs: Song[], artists: Artist[]): Artist[] {
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
