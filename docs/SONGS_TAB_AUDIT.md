# Songs Tab — Audit Report
**Date:** 2026-05-19  
**Scope:** Admin panel Songs tab — `components/admin/SongsAdminView.tsx` + all supporting API routes  
**Purpose:**  
1. Document current state, gaps, and flaws as a baseline  
2. Inform Artists tab redesign (homogenise UI/UX patterns before building on top of them)

---

## 1. Layout Overview

```
┌──────────────────────────────────────────────────────────────┐
│  CurationView                                                │
│  ┌─────────────────────┐  ┌───────────────────────────────┐ │
│  │  Left Rail          │  │  Right Panel                  │ │
│  │  (song list)        │  │  (edit form or empty state)   │ │
│  │                     │  │                               │ │
│  │  [Collapse ▸]       │  │  ← closes when collapsed      │ │
│  └─────────────────────┘  └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The panel is split into a **collapsible left rail** (song list + search/filter) and a **right panel** (selected song edit form, or empty state). The collapse/expand chevron is at the top of the left rail. When collapsed, the right panel takes full width.

---

## 2. Left Rail Anatomy

### 2a. Header bar (above list)

| Element | Description |
|---|---|
| Song count badge | `N songs` — total after filtering |
| Collapse chevron | ◀ / ▶ — hides the left rail, giving more space to the edit form |
| "Add Song" button | Opens blank form + resets `selected` to a fresh stub |
| "Add Multiple" button | Opens `AddMultipleSongsPanel` in a modal |

### 2b. Filter bar

| Filter | Values | Behaviour |
|---|---|---|
| Language | Dynamic dropdown (all distinct `language` values in DB + "All") | Filters song list; also controls artist dropdown options |
| Artist | Dynamic dropdown (artists with songs in selected language) | Filters by `song_artists` join |
| Status | `all \| unreviewed \| reviewed \| flagged` | Maps to `verification_status` |
| Missing field | `lyrics \| title_zh \| artist \| language \| ethnic_group \| …` | Shows only songs lacking that field |

Filters are applied client-side over the full `songs` array fetched on mount.

### 2c. Search input

Free-text search across `title_original`, `title_zh`, `artist_credit`, `artist_display`. Implemented in `lib/search.ts`.

### 2d. Song row (per song in filtered list)

```
[▶ play]  [title_original]        [missing badges]  [✦ Research]  [🗑 Delete]
          [artist_display || artist_credit || —]
          [language · ethnic_group_claimed]
```

- **Play button**: sets `currentSong` in `PlayerContext`, auto-plays
- **Title**: `title_original`; subtitle: `artist_display || artist_credit || '—'`
- **Missing badges**: up to 2 badges (e.g. `no lyrics`, `no title_zh`), then `+N` overflow
- **✦ Research button**: fires `enrichSong()` for this row only (single-song research)
- **🗑 Delete button**: `window.confirm` → `DELETE /api/admin/delete-song`; cascades lyrics, song_artists, song_tags

Clicking anywhere on the row (except the action buttons) selects the song and opens it in the right panel.

---

## 3. Right Panel — State Machine

```
null selected        → Empty state ("Select a song to edit")
new stub selected    → Blank add-song form (title/URL inputs)
existing selected    → Full edit form
```

### 3a. Header card (selected song)

```
[YouTube link icon]  [title_original truncated…]    [status badge]
                     [artist_display || artist_credit]  [🔗 Artist chips]
                     [missing badges]
[✦ Research] [✓ Save Changes] [message area]
```

- **Status badge**: `verification_status` pill (colour-coded)
- **🔗 Artist chips**: one green chip per `linked_artists` entry; each chip has a `✕` unlink button
- **Missing badges**: same computation as left rail
- **✦ Research**: single-song AI enrichment (`enrich-song` route); button state: idle (violet) → researching (red Stop) → complete (blue "Review & Save")
- **✓ Save Changes**: calls `update-song` route; shows "Saved" message then clears

### 3b. Tabs

Two tabs inside the right panel form:

| Tab | Contents |
|---|---|
| **Metadata** | All non-lyrics fields (titles, artist, language, ethnic group, tags, URL, notes, sources) |
| **Lyrics** | Lyrics text, lyrics_source, show_publicly toggle |

Notes field appears at the top of **both** tabs (duplication by design — it's often needed in context).

---

## 4. Metadata Tab — Field Coverage

| Field | DB column | Form element | AI fills? | Notes |
|---|---|---|---|---|
| Notes | `songs.notes` | Textarea (top, both tabs) | No | Internal curation notes |
| Title (original) | `title_original` | Text input | Yes | Indigenous or "most original" title; `hasChinese()` guard prevents CJK contamination |
| Title (Chinese) | `title_zh` | Text input | Yes | Official sources only; AI instruction: no AI translations, no genre descriptors |
| Title (romanized) | `title_romanized` | — | — | Stub field on type; not surfaced in form; PLAN.md: remove post-demo |
| Artist credit | `songs.artist_credit` | Text input (read-ish) | Yes | Raw string from YouTube/AI; shown alongside linked artist chips |
| Language | `songs.language` | Select (controlled vocab) | Yes | Must match `data/controlled-vocab.json` |
| Ethnic group | `songs.ethnic_group_claimed` | Select | Yes | Single value; distinct from `artists.ethnic_groups` |
| Tags | `song_tags → tags` | Multi-select (tag picker) | No | Controlled vocabulary |
| YouTube URL | `songs.yt_url` | Text input | Pre-filled | Non-YouTube URLs stripped on load and moved to `url` field |
| Other URL | `songs.url` | Text input | No | Non-YouTube URLs |
| Verification status | `songs.verification_status` | Select | No | Must match controlled vocab |
| Confidence | `songs.confidence` | Select | No | Must match controlled vocab |

### 4a. AI field mapping (`enrich-song` response → draft)

The AI returns an `enriched` object. `mergeEnriched(draft, enriched)` is called after research:
- Base is always the current `draft` (manual edits survive re-research)
- AI value wins if non-null and non-empty
- `artist_credit` and titles are sent to AI as context (corrected values guide research)

---

## 5. Lyrics Tab — Field Coverage

| Field | DB column | Form element | AI fills? | Notes |
|---|---|---|---|---|
| Notes | `songs.notes` | Textarea (top, both tabs) | No | Same as Metadata tab |
| Lyrics | `lyrics.content` | Textarea | Yes | Multi-line; hidden if `show_publicly = false` on public site |
| Lyrics source | `lyrics.lyrics_source` | Text input | Yes | First grounding source title promoted if AI gives generic attribution; `[not found — AI date]` sentinel when not found |
| Show publicly | `lyrics.show_publicly` | Toggle | No | Default `false`; admin approves manually |

**Gap:** `lyrics_source` is **not** loaded from DB in `draftFromSong()`. It initializes as `''` on form open, meaning any existing `lyrics_source` value is invisible to the editor unless they Research first. (See Gap #1 in §8.)

---

## 6. Workflow Details

### 6a. Single-song Research (✦ button)

1. User clicks ✦ on a left-rail row OR ✦ Research in the right panel header
2. `enrichSong(song)` fires `POST /api/admin/enrich-song` with `{ yt_url, artist_credit, title_original }`
3. Button enters "researching" (red Stop) state; clicking Stop aborts the fetch
4. Response: `{ enriched, sources, artist_match }`
5. `mergeEnriched(draft, enriched)` merges AI fields into current draft
6. If `artist_match` found and not already linked: auto-POSTs `/api/admin/link-song-artist`; updates `linked_artists` and `artist_display` in state
7. Button enters "complete" (blue "Review & Save") state; form shows diff
8. User reviews and saves (or discards)

### 6b. Batch Review (Review & Save button)

Appears on songs that have been researched via "Research All". The button in the left rail row header turns blue. Clicking it opens the song in the right panel with the AI-enriched draft pre-loaded. User edits and saves.

### 6c. Research All

1. "Research All" button above the filtered list
2. Iterates over all filtered songs sequentially (not parallel — avoids Gemini rate limits)
3. Each song: same `enrich-song` call; merged into draft; stored in a `pendingReviews` map keyed by song ID
4. After all songs processed: left rail rows show "Review & Save" buttons
5. **Gap:** No confirmation dialog for >10 songs (accidental batch research). (See Gap #2 in §8.)

### 6d. Save paths

Three distinct save paths exist; all eventually call `POST /api/admin/update-song`:

| Path | How triggered | Base for merge |
|---|---|---|
| **Manual edit** | User edits fields, clicks "Save Changes" | Current `draft` state |
| **Single research → save** | ✦ Research → "Review & Save" in header | `mergeEnriched(draft, enriched)` |
| **Research All → review → save** | "Research All" → "Review & Save" on row | `mergeEnriched(draftFromSong(song), enriched)` |

**Gap (Research All path):** Base is `draftFromSong(song)` (DB snapshot), not the current `draft`. If the user has manually edited the form before triggering Research All, those edits are lost for songs processed by Research All. This is intentional for batch consistency but undocumented. (See Gap #3 in §8.)

### 6e. Song Delete

1. Click 🗑 on left-rail row
2. `window.confirm("Delete…?")` dialog
3. `DELETE /api/admin/delete-song` with `{ song_id }`
4. Cascades via DB FK: `song_artists`, `lyrics`, `song_tags` deleted
5. Song removed from local `songs` state; right panel cleared if it was selected

### 6f. Artist Link / Unlink

**Auto-link (on Research):** If `enrich-song` returns `artist_match`, the song is auto-linked via `POST /api/admin/link-song-artist`. The user sees a new green 🔗 chip immediately.

**Manual unlink:** Click `✕` on a green 🔗 chip in the right panel header. Calls `DELETE /api/admin/link-song-artist`. Chip disappears.

**Gap:** There is no **manual link** UI — no "Link artist…" type-ahead picker. If `artist_match` doesn't fire (new artist or credit mismatch), the only way to link is to go to the Artists tab, find the artist, and link from there (which also doesn't currently exist as a UI element from the artist side). (See Gap #4 in §8.)

---

## 7. API Routes — Summary

| Route | Method | Purpose |
|---|---|---|
| `GET /api/admin/all-songs` | GET | Fetch all songs with `linked_artists`, `artist_display`, `missing` badges |
| `POST /api/admin/update-song` | POST | Update song fields + lyrics |
| `POST /api/admin/save-song` | POST | Insert new song |
| `DELETE /api/admin/delete-song` | DELETE | Delete song + cascades |
| `POST /api/admin/enrich-song` | POST | Gemini enrichment + artist_match lookup |
| `POST /api/admin/link-song-artist` | POST | Insert `song_artists` row; return updated linked list |
| `DELETE /api/admin/link-song-artist` | DELETE | Remove `song_artists` row; return updated linked list |
| `GET /api/admin/unaudited-songs` | GET | Songs with `verification_status = 'unreviewed'` |

---

## 8. Gaps and Flaws

| # | Severity | Location | Description |
|---|---|---|---|
| 1 | **High** | `draftFromSong()` in `SongsAdminView` | `lyrics_source` is not loaded from DB. Opening a song with an existing `lyrics_source` shows an empty field. User must Research to see it, potentially overwriting a manually set value. |
| 2 | **Medium** | Research All button | No confirmation for large batches (>10 songs). Easy to accidentally fire on the full unfiltered list (84 songs = 84 Gemini calls, ~$0.50+, ~3 min). |
| 3 | **Low/Info** | Research All merge path | Uses `draftFromSong(song)` as base, not current `draft`. Manual edits made before Research All are silently ignored for batch-processed songs. This is intentional but undocumented. |
| 4 | **High** | Right panel — artist area | No manual "Link artist…" picker. If auto-link fails (new artist, credit mismatch), user cannot link from the Songs tab at all. They must navigate to the Artists tab. |
| 5 | **Medium** | Right panel — after save | Form is not repopulated from DB after save. If the server normalises a field (e.g. trims whitespace, corrects a slug), the form still shows the pre-save value until next page load. |
| 6 | **Low** | Left rail — missing badges | Badge computation is client-side (from the `missing` array returned by `/api/admin/all-songs`). If a song is saved and missing badges change, the badge in the left rail doesn't update until the list is re-fetched. |
| 7 | **Low** | Left rail — artist subtitle | Falls back to `artist_credit` if no `artist_display`. When `artist_credit` is a long compound string (e.g. "feat." separated), it wraps awkwardly and disrupts row height. |
| 8 | **Low** | Lyrics tab | `show_publicly` toggle has no visual feedback about what "false" means for public viewers. A tooltip or inline help text would reduce accidental approvals. |
| 9 | **Info** | `title_romanized` field | Defined in `lib/types.ts` as a Song field, never surfaced in the form, never populated. PLAN.md marks it for removal post-demo. No user-facing impact now. |
| 10 | **Medium** | Batch mode | No bulk-select / bulk-action capability. "Research All" is the only batch operation. There is no "bulk change language", "bulk approve lyrics", or "bulk add tag". |
| 11 | **Low** | Song row actions | ✦ Research and 🗑 Delete are only in the left rail row. If the left rail is collapsed (full-width edit form), there is no way to delete or trigger research without re-expanding it. Consider adding these buttons to the right panel header. |
| 12 | **Info** | `unaudited-songs` endpoint | Returns songs with `verification_status = 'unreviewed'`. This is used by the Metrics panel, not by the Songs tab filter. The Songs tab `status` filter handles the same data differently (client-side). Potential for inconsistency if filter logic diverges. |

---

## 9. Phased Improvement Plan

### Phase A — Bug fixes (do first; unblock daily workflow)

| Task | Gap | Effort |
|---|---|---|
| Load `lyrics_source` in `draftFromSong()` | #1 | XS — add one field to the Supabase select + draftFromSong mapping |
| Research All confirmation for >10 songs | #2 | XS — `if filtered.length > 10 && !window.confirm(...)` |
| Re-populate form from server after save | #5 | S — after save, re-fetch the updated song and call `draftFromSong()` |
| Manual "Link artist…" picker in song edit form | #4 | M — type-ahead input searching `artist_names`, calls `link-song-artist` on select |

### Phase B — Artists tab homogenisation (before building Artists tab features)

Goals:
- Artists left rail: add tabs **All | Unlinked** inline with the existing **All / Individual / Groups** toggle buttons (tabs sit to the left of the group filter); eliminates current awkward top-section unlinked queue
- Artists edit form: match header card pattern from Songs (name + badges + action buttons)
- Shared `<Field>` and `<SelectField>` subcomponents extracted from SongsAdminView and reused in ArtistsAdminView
- Batch mode for artists: "Research All (unlinked)" batch button mirrors Song Research All
- Missing badges on artist rows (same pattern: up to 2 + `+N` overflow)
- Artist row collapse/expand chevron (same as Songs)

### Phase C — Bidirectional artist–song linking rethink

Current state: linking is unidirectional (song → artist) and only triggered from the Songs tab.

Goals:
- **From Songs tab:** Manual "Link artist…" picker in edit form (Phase A #4)
- **From Artists tab:** "Add song…" picker in artist detail panel — search songs by title, click adds `song_artists` row
- **Unlinked queue:** move to Artists tab (left-rail "Unlinked" tab), where it belongs conceptually
- **Auto-link on artist save:** already works (save-artist does ilike scan); surface result count in success toast
- **Re-link button:** on artist edit form, a "Re-scan songs" button that re-runs the ilike scan for all aliases and links any newly matched songs

---

## 10. Artist Display — Current Priority Order

As of 2026-05-19, `artist_display` is computed server-side in `unaudited-songs/route.ts` and `link-song-artist/route.ts`:

```
ab name (if exists) – zh name (if exists)
en name (if exists) – zh name (if exists)
zh name (if exists, fallback)
```

Priority: **`ab > en > zh`**. The `–` separator is literal em-dash.  
Source: `lib/types.ts` `names_ab` comment; `DATA_SCHEMA.md` script priority section.

---

*End of audit report. See PLAN.md for current roadmap and done/pending tracking.*
