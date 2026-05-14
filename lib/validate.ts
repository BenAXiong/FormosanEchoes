import type { Song } from './types';

const REQUIRED_ONE_OF_TITLE = ['title_original', 'title_romanized', 'title_chinese'] as const;
const REQUIRED_ONE_OF_SOURCE = ['artist', 'source_platform', 'url'] as const;
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high', 'unknown']);
const VALID_STATUS = new Set([
  'candidate', 'needs_review', 'checked',
  'approved_public', 'approved_private', 'rejected', 'duplicate',
]);

export interface ValidationWarning {
  song_id: string;
  field?: string;
  message: string;
}

export function validateSongs(songs: Song[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const song of songs) {
    const id = song.id ?? '(no id)';

    // Duplicate ID
    if (seenIds.has(id)) {
      warnings.push({ song_id: id, field: 'id', message: 'Duplicate ID' });
    }
    seenIds.add(id);

    // Missing title
    const hasTitle = REQUIRED_ONE_OF_TITLE.some((f) => !!(song as unknown as Record<string, unknown>)[f]);
    if (!hasTitle) {
      warnings.push({ song_id: id, field: 'title', message: 'Missing all title fields' });
    }

    // Missing source
    const hasSource = REQUIRED_ONE_OF_SOURCE.some((f) => !!(song as unknown as Record<string, unknown>)[f]);
    if (!hasSource) {
      warnings.push({ song_id: id, field: 'source', message: 'Missing artist, platform, and URL' });
    }

    // Invalid confidence
    if (!VALID_CONFIDENCE.has(song.confidence)) {
      warnings.push({ song_id: id, field: 'confidence', message: `Invalid confidence: "${song.confidence}"` });
    }

    // Invalid verification status
    if (!VALID_STATUS.has(song.verification_status)) {
      warnings.push({ song_id: id, field: 'verification_status', message: `Invalid status: "${song.verification_status}"` });
    }

    // Duplicate URL
    if (song.url) {
      if (seenUrls.has(song.url)) {
        warnings.push({ song_id: id, field: 'url', message: `Duplicate URL: ${song.url}` });
      }
      seenUrls.add(song.url);
    }

    // Language claim without evidence
    if (song.language_claimed && song.language_claimed !== 'Unknown' && !song.language_evidence) {
      warnings.push({ song_id: id, field: 'language_evidence', message: 'Language claimed but no evidence provided' });
    }

    // Lyrics public without permission
    if (song.lyrics?.show_publicly && !song.lyrics?.has_permission) {
      warnings.push({ song_id: id, field: 'lyrics', message: 'Lyrics marked show_publicly but has_permission is false' });
    }

    // Lyrics public without rights status
    if (song.lyrics?.show_publicly && !song.lyrics?.lyrics_rights_status) {
      warnings.push({ song_id: id, field: 'lyrics', message: 'Lyrics marked show_publicly but no rights status' });
    }
  }

  return warnings;
}
