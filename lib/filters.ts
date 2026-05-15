import type { Song, FilterState } from './types';

/** Apply all active filters to a song list. All active filters must match (AND logic). */
export function filterSongs(songs: Song[], filters: FilterState): Song[] {
  return songs.filter((song) => {
    if (filters.language && song.language_claimed !== filters.language) return false;
    if (filters.ethnic_group && song.ethnic_group_claimed !== filters.ethnic_group) return false;
    if (filters.artist_id && !(song.artist_ids ?? []).includes(filters.artist_id)) return false;
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
  artist_id: '',
  tag: '',
  confidence: '',
  verification_status: '',
  has_lyrics: null,
  only_favorites: false,
  playlist_id: null,
};

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    !!filters.language ||
    !!filters.ethnic_group ||
    !!filters.artist_id ||
    !!filters.tag ||
    !!filters.confidence ||
    !!filters.verification_status ||
    filters.has_lyrics !== null ||
    filters.only_favorites ||
    !!filters.playlist_id
  );
}
