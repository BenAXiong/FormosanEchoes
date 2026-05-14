import type { Song, FilterState } from './types';

/** Apply all active filters to a song list. All active filters must match (AND logic). */
export function filterSongs(songs: Song[], filters: FilterState): Song[] {
  return songs.filter((song) => {
    if (filters.language && song.language_claimed !== filters.language) return false;
    // ethnic_group filter is repurposed as artist_id filter
    if (filters.ethnic_group) {
      const linked = (song.artist_ids ?? []).includes(filters.ethnic_group);
      if (!linked) return false;
    }
    if (filters.tag && !song.tags?.includes(filters.tag)) return false;
    if (filters.confidence && song.confidence !== filters.confidence) return false;
    if (filters.verification_status && song.verification_status !== filters.verification_status) return false;
    if (filters.has_lyrics === true && !song.lyrics?.show_publicly) return false;
    if (filters.has_lyrics === false && song.lyrics?.show_publicly) return false;
    return true;
  });
}

export const DEFAULT_FILTERS: FilterState = {
  language: '',
  ethnic_group: '',
  tag: '',
  confidence: '',
  verification_status: '',
  has_lyrics: null,
};

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    !!filters.language ||
    !!filters.ethnic_group ||
    !!filters.tag ||
    !!filters.confidence ||
    !!filters.verification_status ||
    filters.has_lyrics !== null
  );
}
