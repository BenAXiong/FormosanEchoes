import type { Song } from './types';
import { buildSearchText } from './normalize';
import { validateSongs } from './validate';
import rawSongs from '../data/songs.json';
import { normalizeSong } from './normalize';

let _songs: Song[] | null = null;

export function getSongs(): Song[] {
  if (_songs) return _songs;
  _songs = (rawSongs as unknown as Partial<Song>[]).map(normalizeSong);

  // Log validation warnings in development
  if (process.env.NODE_ENV === 'development') {
    const warnings = validateSongs(_songs);
    if (warnings.length > 0) {
      console.group('[SoF] Data validation warnings');
      warnings.forEach((w) => console.warn(`[${w.song_id}] ${w.field ? `${w.field}: ` : ''}${w.message}`));
      console.groupEnd();
    }
  }

  return _songs;
}

export { buildSearchText };
