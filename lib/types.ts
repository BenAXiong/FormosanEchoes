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
// linked to a recording. One performer can have multiple romanized/Chinese names.

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
  tags: string[];
  source_snippets?: string;
  verification_notes?: string;
  confidence: ConfidenceLevel;
  verification_status: VerificationStatus;
  needs_manual_verification: boolean;
  checked_by_me: boolean;
  date_added?: string;
  lyrics?: LyricsData;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface FilterState {
  language: string;
  ethnic_group: string;       // was people_group — filters by ethnic/cultural origin
  tag: string;
  confidence: string;
  verification_status: string;
  has_lyrics: boolean | null;
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
