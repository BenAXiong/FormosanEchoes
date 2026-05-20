// ─── Confidence & Verification ────────────────────────────────────────────────

export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'unknown';

export type VerificationStatus =
  | 'candidate'
  | 'needs_review'
  | 'checked'
  | 'approved_public'
  | 'approved_private'
  | 'rejected'
  | 'duplicate';

// ─── Performers ───────────────────────────────────────────────────────────────
// Distinct from ethnic_group: a Performer is a specific person or ensemble
// linked to a recording. One performer can have multiple Latin-script/Chinese names.

export type PerformerRole = 'vocalist' | 'composer' | 'lyricist' | 'arranger' | 'group';

export interface Performer {
  id: string;
  name_display: string;          // primary display name
  names_zh?: string[];           // Chinese name variants
  names_rom?: string[];          // Romanized name variants
  role?: PerformerRole[];
  ethnic_group?: string;
  notes?: string;
}

// ─── Lyrics ───────────────────────────────────────────────────────────────────

export interface LyricsData {
  song_id: string;
  lyrics_original?: string;
  lyrics_romanized?: string;
  lyrics_translation_zh?: string;
  lyrics_translation_en?: string;
  lyrics_source?: string;
  lyrics_rights_status?: string;
  lyrics_notes?: string;
  has_permission: boolean;
  show_publicly: boolean;
}

// ─── Song ─────────────────────────────────────────────────────────────────────

export interface Song {
  id: string;
  title_original?: string;
  title_romanized?: string;
  title_chinese?: string;
  yt_title?: string;            // raw YouTube video title — provenance only, never curated
  artist?: string;
  language_claimed?: string;
  language_evidence?: string;
  // ethnic_group: the cultural/ethnic origin of the song (separate from performers)
  ethnic_group_claimed?: string;
  ethnic_group_evidence?: string;
  // performers: specific people/groups linked to a recording (stub for future feature)
  performers?: Performer[];
  source_platform?: string;
  url?: string;
  youtube_url?: string;
  lyrics_url?: string;
  album_or_source?: string;
  year?: string | number;
  location_claimed?: string;
  region?: string;
  genre?: string;
  recording_type?: string;
  tags: string[];
  source_snippets?: string;
  verification_notes?: string;
  confidence: ConfidenceLevel;
  verification_status: VerificationStatus;
  needs_manual_verification: boolean;
  checked_by_me: boolean;
  date_added?: string;
  artist_ids?: string[];          // resolved links into artists.json
  lyrics?: LyricsData;
}

// ─── Artist ───────────────────────────────────────────────────────────────────

export interface Artist {
  id: string;
  name_display: string;
  names_zh: string[];       // script='zh'; first = official Chinese name, rest = aliases
  names_en: string[];       // script='en'; first = official Latin-script name, rest = variants
  names_ab: string[];       // script='ab'; name in the indigenous language's own form
  zh_surname: string | null;
  ethnic_groups: string[];  // multi-value; replaces ethnic_group
  language: string | null;
  is_group: boolean;
  active_years: string | null;
  bio_zh: string | null;
  bio_en: string | null;
  bio_ycm: string | null;
  youtube_channel: string | null;
  wikipedia_url: string | null;
  website_url: string | null;
  sources: string[];        // provenance URLs/refs; DB-backed
  notes: string | null;
  photo_url: string | null;
  researched_fields: string[];  // missing-badge keys confirmed N/A after research
  group_ids: string[];      // groups this person belongs to
  member_ids: string[];     // members of this group (non-empty when is_group=true)
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface FilterState {
  language: string;
  ethnic_group: string;       // filters by song.ethnic_group_claimed
  artist_id: string;          // filters by song.artist_ids membership
  tag: string;
  confidence: string;
  verification_status: string;
  has_lyrics: boolean | null;
  recording_type: string;
  only_favorites: boolean;
  playlist_id: string | null;
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export interface LanguageOption {
  value: string;
  label: string;
}

export interface EthnicGroupOption {
  value: string;
  label: string;
}

export interface Tag {
  value: string;
  label: string;
}

export interface ControlledVocab {
  languages: LanguageOption[];
  ethnic_groups: EthnicGroupOption[];
  tags: Tag[];
  confidence_levels: { value: ConfidenceLevel; label: string }[];
  verification_statuses: { value: VerificationStatus; label: string }[];
}

// ─── Playlists ────────────────────────────────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}
