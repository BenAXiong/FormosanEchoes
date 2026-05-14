import type { Song } from './types';
import { buildSearchText } from './normalize';

/**
 * Filter songs by a free-text search query.
 * Case-insensitive, partial match, safe on null/undefined fields.
 */
export function searchSongs(songs: Song[], query: string): Song[] {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter((song) => buildSearchText(song).includes(q));
}
