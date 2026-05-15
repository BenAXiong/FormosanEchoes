# PLAN.md — Formosan Echoes Roadmap

Living document. Update at the end of any session that completes a task or changes scope.

---

## Current state (as of 2026-05-16)

### Done
- Working public demo (`/`): search, filters, language/artist facets, favorites, playlists, persistent bottom player
- Admin panel (`/admin?key=654321`): Browse, Add Song (YouTube → Gemini enrich → save), Artist Audit
- Gemini 2.5 Flash enrichment with web search grounding
- Artist filter fixed: proper `artist_id` field in FilterState, sidebar resets on language change
- Tooltip debounce fixed: 300ms hover dwell before fetch + show
- `getArtistsWithSongs` simplified: only shows artists whose songs have `artist_ids` populated
- ADR log (`docs/DECISIONS.md`), field reference (`docs/DATA_SCHEMA.md`), agent guide (`AGENTS.md`) — all current
- Supabase project created, schema designed and finalized

### In progress
- **Supabase migration** — schema SQL written (`supabase/schema.sql`), migration script written (`scripts/migrate-to-supabase.mjs`)
  - [ ] User pastes `supabase/schema.sql` into Supabase SQL editor and runs it
  - [ ] Run `npm run migrate` to import JSON data into Supabase
  - [ ] Swap `lib/data.ts` to read from Supabase
  - [ ] Swap `/api/admin/save-song` to write to Supabase (with server-side artist resolution)
  - [ ] Remove `scripts/link-artists.js` from prebuild once data layer is fully migrated

---

## Immediate fixes still pending

- [ ] Player bar vs embed sync — timestamp and play/pause state drift between master PlayerBar and DemoNowPlaying mirror
- [ ] Song card artist display — inconsistent between raw `artist_credit` string and resolved artist name

---

## Data model (post-migration)

Schema is in Supabase. See `supabase/schema.sql` for full DDL.

Tables: `artists`, `artist_names`, `songs`, `song_artists`, `lyrics`, `tags`, `song_tags`

Pending field additions (when ready):
- [ ] `awards` field on songs
- [ ] `performance_style` field on songs
- [ ] Expand tag vocabulary

---

## Near-term features

- [ ] **Sorting algorithm** — relevance-based ordering (approved > checked > candidate; weight by language coverage)
- [ ] **Karaoke-style UI** — timed lyric highlighting for singing practice
- [ ] **Lyrics search** — full-text search returning songs that contain a given word or phrase (Supabase FTS)
- [ ] **Language toggle** — zh / en / ab display switch across the UI
- [ ] **OAuth** — replace hard-coded admin key with Supabase Auth

---

## Admin tooling

- [ ] Upgrade enrichment to Gemini 2.5 Pro for better accuracy
- [ ] Lyrics enrichment from song title or URL
- [ ] **Batch import pipeline** — automated ingestion at scale
  - Scrape → Gemini enrich → filter by aboriginal lyric threshold → INSERT into Supabase
  - Artist resolution happens at write time in the API, not as a separate batch step
  - Goal: all songs from all indigenous singers findable online

---

## Post-demo

- [ ] Dialect sub-tags
- [ ] Contributor system — user-submitted songs with moderation queue
- [ ] Lyrics correction workflow
- [ ] Artist pages
- [ ] Collection / label pages
