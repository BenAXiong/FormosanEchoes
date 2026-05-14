# PLAN.md — Sequential Task List for Antigravity

This is the recommended implementation sequence. Follow it in order unless the user changes the priority.

---

## Phase 0 — Project Inspection

### Goal

Understand the existing repository before changing anything.

### Tasks

1. Inspect the root folder.
2. Identify framework: Next.js, Vite, plain React, or other.
3. Identify package manager: npm, pnpm, yarn, bun.
4. Read existing README and config files.
5. Check whether Tailwind is already installed.
6. Check whether Supabase is already configured.
7. Check whether Vercel config exists.
8. Summarize the current state before editing.

### Completion criteria

The agent can state:

```text
Framework:
Package manager:
Styling system:
Data source:
Existing deployment config:
Main app entry file:
```

---

## Phase 1 — Create Project Docs and Data Contracts

### Goal

Make the project understandable before building UI.

### Tasks

1. Add or update `AGENTS.md` with the general instructions.
2. Add `docs/DATA_SCHEMA.md`.
3. Add `docs/WORKFLOW.md`.
4. Add `docs/OPAL_PROMPT.md`.
5. Add `lib/types.ts` or equivalent.

### `docs/DATA_SCHEMA.md` should explain

- Song fields
- Lyrics fields
- Source/evidence fields
- Confidence values
- Verification statuses
- Which fields are public-safe
- Which fields are private/internal

### `docs/WORKFLOW.md` should explain

```text
Opal → Google Sheet → manual check → JSON/Supabase → webapp
```

### `docs/OPAL_PROMPT.md` should include

A clean prompt for Opal that asks for structured candidate metadata rows with evidence and confidence.

### Completion criteria

- Types exist.
- Docs exist.
- Schema is explicit.
- No UI needs to be finished yet.

---

## Phase 2 — Create Mock Data

### Goal

Build the UI against realistic local data before connecting external services.

### Tasks

1. Create `data/songs.mock.json`.
2. Include 5–10 representative mock songs.
3. Include mixed data quality:
   - one verified song
   - one low-confidence song
   - one song with public lyrics
   - one song with lyrics blocked from public display
   - one song with missing romanization
   - one song with multiple tags
4. Create `data/controlled-vocab.json` for languages, people/groups, tags, and confidence values.

### Mock data rules

Do not include real copyrighted lyrics unless they are very short placeholders or clearly fake sample text.

Use placeholders such as:

```text
[Sample original lyric line]
[Sample romanization line]
[Sample Chinese translation]
```

### Completion criteria

The mock data can power the whole UI without external APIs.

---

## Phase 3 — Data Loading and Validation

### Goal

Make data safe to render.

### Tasks

1. Add `lib/data.ts` to load mock songs.
2. Add `lib/normalize.ts` to normalize empty fields, arrays, and tags.
3. Add `scripts/validate-data.ts` or a simple validation helper.
4. Detect common problems:
   - missing title
   - missing source URL
   - duplicate ID
   - duplicate URL
   - invalid confidence value
   - lyrics marked public without rights status
5. Make the UI resilient to missing values.

### Completion criteria

- Invalid rows do not crash the app.
- Validation warnings are visible in development logs or script output.
- Data types are used consistently.

---

## Phase 4 — Build Search and Filter Logic

### Goal

Create pure utility functions before UI.

### Tasks

1. Add `lib/search.ts`.
2. Implement simple client-side search.
3. Search across title, artist, language, people/group, tags, region, genre, album/source, and notes.
4. Add `lib/filters.ts`.
5. Implement filters for:
   - language
   - people/group
   - tags
   - confidence
   - verification status
   - has public lyrics
6. Add basic tests if the repo already has a test framework.

### Completion criteria

- Search works independently of the UI.
- Filters can be combined.
- Empty search returns all songs.
- No crashes on missing fields.

---

## Phase 5 — Build Core UI Components

### Goal

Create reusable components for the main browsing interface.

### Components

Build these components or equivalent:

```text
SearchBar
FilterBar
SongCard
VerificationBadge
SourceLinks
MediaEmbed
LyricsPanel
SongDetailPanel
```

### Requirements

`SearchBar`:
- controlled input
- accessible label
- clear button if useful

`FilterBar`:
- language filter
- people/group filter
- tag filter
- confidence filter
- verification filter
- has lyrics filter

`SongCard`:
- compact summary
- clear selected state
- title, artist, language, people/group, tags, confidence

`MediaEmbed`:
- YouTube embed if valid YouTube URL exists
- fallback source button otherwise
- no crash on invalid URL

`LyricsPanel`:
- show lyrics only if `show_publicly` is true
- show original / romanization / translation sections when available
- show safe fallback when lyrics are missing or private

`SongDetailPanel`:
- selected song details
- media embed
- lyrics panel beside or below media depending on screen size
- source/evidence information

### Completion criteria

Components render correctly using mock data.

---

## Phase 6 — Compose Main Page

### Goal

Build the first usable version of the app.

### Tasks

1. Create the main page layout.
2. Load mock songs.
3. Add search state.
4. Add filter state.
5. Display filtered song cards.
6. Let user select a song.
7. Show selected song in the detail panel.
8. Include empty state when no results match.
9. Make layout responsive.

### Desktop target

```text
Top: title/search/filters
Main left: card list/grid
Main right: selected song detail + media + lyrics
```

### Mobile target

```text
Top: title/search/filters
Cards stacked
Selected song detail appears below selected card or in a clear section
Lyrics below player
```

### Completion criteria

The app is usable as a local prototype.

---

## Phase 7 — Polish Trust and Evidence Display

### Goal

Make uncertainty visible without making the UI ugly.

### Tasks

1. Add confidence badges.
2. Add verification badges.
3. Add source links.
4. Add collapsible or compact evidence section.
5. Display language evidence and people/group evidence.
6. Display verification notes if present.
7. Make low-confidence entries visually distinct but not alarming.

### Completion criteria

A user can tell whether a song is verified, uncertain, or needs review.

---

## Phase 8 — Prepare Google Sheet Export Integration

### Goal

Make it easy to use exported Sheet data.

### Tasks

1. Define expected exported CSV/JSON format.
2. Add documentation for exporting from Sheets.
3. Add a script or instructions to convert Sheet CSV to app JSON.
4. Validate converted data.
5. Keep mock data as fallback.

### Recommended simple path

```text
Google Sheet → download/export CSV → script converts to JSON → app reads JSON
```

### Completion criteria

The user can replace mock data with cleaned exported data without touching UI code.

---

## Phase 9 — Optional Supabase Preparation

### Goal

Prepare for Supabase without forcing it into the first version.

### Tasks

1. Add `docs/SUPABASE_SCHEMA.md` if requested.
2. Draft tables:
   - `songs`
   - `artists`
   - `lyrics`
   - `sources`
   - `tags`
   - `song_tags`
   - `song_candidates`
3. Add environment variable examples.
4. Add a future `lib/supabase.ts` only when actual Supabase integration is requested.

### Do not do yet unless asked

- Do not create auth.
- Do not create admin pages.
- Do not migrate the whole app to Supabase prematurely.

### Completion criteria

Supabase path is documented but not required for the prototype.

---

## Phase 10 — Deployment Readiness

### Goal

Make the prototype deploy cleanly to Vercel.

### Tasks

1. Ensure build command works.
2. Ensure no private env vars are required for mock-data mode.
3. Add README instructions.
4. Add Vercel deployment notes.
5. Run build locally if possible.
6. Fix TypeScript and lint errors.

### Completion criteria

The app can be pushed to GitHub and deployed on Vercel with minimal setup.

---

## Phase 11 — Final Review Checklist

Before handing back to the user, verify:

### Functionality

- Search works.
- Filters work.
- Combined search + filters work.
- Song selection works.
- Player/embed works or falls back safely.
- Lyrics display only when allowed.
- Private lyrics do not display.
- Source links work.
- Confidence/verification badges display.

### Data safety

- Missing fields do not crash the app.
- Duplicate IDs are caught or warned.
- Invalid URLs do not crash the app.
- Lyrics rights flags are respected.

### UX

- Desktop layout is clean.
- Mobile layout is usable.
- Empty state is clear.
- Long text wraps properly.
- Tags do not overflow.

### Build

- TypeScript check passes if available.
- Lint passes if available.
- Production build passes if available.

---

## Phase 12 — Suggested Next Improvements After MVP

Only after the basic app works:

1. Replace mock JSON with exported Sheet JSON.
2. Add better CSV import tooling.
3. Add Supabase canonical database.
4. Add private review queue.
5. Add admin approval UI.
6. Add public/private lyrics logic from database.
7. Add full-text search.
8. Add timestamped lyrics if the data exists.
9. Add artist pages.
10. Add source/collection pages.

---

## First Coding Session Prompt for Antigravity

Use this prompt to start a fresh coding-agent session:

```text
You are working on a minimalist Formosan-language song metadata browser.

Read the project plan and AGENTS.md before coding. Your first goal is not to build the whole app. Your first goal is to create a stable prototype using local mock JSON data.

Build the app with the existing stack if one exists. If the repo is empty, use Next.js + TypeScript + Tailwind.

Core requirements:
- searchable song cards
- filters for language, people/group, tags, confidence, and verification status
- selected song detail panel
- YouTube/media embed if available
- lyrics panel beside the song detail on desktop and below it on mobile
- lyrics must only display when show_publicly is true
- source/evidence/verification fields must be visible in the detail view
- no auth, no database, no public submissions, no complex admin system yet

Implementation order:
1. Inspect the repo and summarize the current state.
2. Add TypeScript data types.
3. Add realistic mock data.
4. Add data validation helpers.
5. Add search/filter utilities.
6. Build small UI components.
7. Compose the main page.
8. Run available checks.
9. Report files changed, how to run, checks performed, limitations, and next step.

Do not overbuild. Preserve uncertainty. Do not publicly display lyrics unless the data explicitly allows it.
```

---

## Opal Prompt Draft for Intake Workflow

Use this prompt inside Opal or adapt it for an Opal step:

```text
Create a candidate metadata row for a Formosan-language song database.

Input is ONE free-text field called lead.

The lead may contain any one of these:
- a YouTube URL
- a lyrics URL
- an artist name
- a song title
- an album/source page
- a playlist URL
- a general search phrase

The user should not need to fill all of those fields. They should paste only whatever clue they currently have.

Your job:
1. Identify what kind of lead this is.
2. Search for relevant public sources if needed.
3. Extract possible song metadata.
4. Normalize the result into the schema below.
5. Preserve evidence for language and people/group claims.
6. Do not overclaim. If uncertain, mark confidence as low or unknown.
7. Artist ethnicity alone is not enough to identify song language.
8. Default needs_manual_verification to true.

Return JSON only.

Schema:
{
  "title_original": "",
  "title_romanized": "",
  "title_chinese": "",
  "artist": "",
  "language_claimed": "",
  "language_evidence": "",
  "people_group_claimed": "",
  "people_group_evidence": "",
  "source_platform": "",
  "url": "",
  "youtube_url": "",
  "lyrics_url": "",
  "album_or_source": "",
  "year": "",
  "location_claimed": "",
  "region": "",
  "genre": "",
  "tags": [],
  "source_snippets": "",
  "verification_notes": "",
  "confidence": "low|medium|high|unknown",
  "needs_manual_verification": true,
  "checked_by_me": false,
  "date_added": "YYYY-MM-DD"
}

Confidence rules:
- high: reliable source explicitly labels the language or lyrics source clearly identifies it
- medium: multiple weak signals agree but no direct language label exists
- low: inferred from artist, playlist, comments, or indirect context
- unknown: no defensible evidence
```

---

## Stable Long-Term Workflow Target

Once the prototype works and the schema stabilizes, move toward this architecture:

```text
Opal private intake mini-app
  → Supabase song_candidates review queue
  → private admin review page
  → Supabase canonical tables
  → Vercel public webapp
```

For the first build, keep the flow simpler:

```text
Opal
  → Google Sheet
  → cleaned exported JSON
  → local app data file
  → Vercel prototype
```
