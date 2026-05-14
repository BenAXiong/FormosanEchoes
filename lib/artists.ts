import type { FilterState } from '@/lib/types';

export interface Artist {
  id: string;
  name_display: string;
  names_zh: string[];
  names_rom: string[];
  names_indigenous: string[];
  ethnic_group: string;
  language: string;
  notes: string | null;
}

const raw: Artist[] = require('@/data/artists.json');

export function getArtists(): Artist[] {
  return raw;
}

/** All name variants for an artist, lowercase, for matching against song.artist strings */
export function getArtistAliases(artist: Artist): string[] {
  return [
    artist.name_display,
    ...artist.names_zh,
    ...artist.names_rom,
    ...artist.names_indigenous,
  ].map((s) => s.toLowerCase());
}
