# PLAN.md — Formosan Echoes Roadmap

Living document. Update at the end of any session that completes a task or changes scope.

---

## Current state (as of 2026-05-18)

### Done
- Working public browser (`/`): search, filters, language/artist facets, favorites, playlists, persistent bottom player
- Admin panel (`/admin?key=654321`): Browse, Add Song (YouTube → Gemini enrich → save), Artist Audit, Song Audit
- Gemini 2.5 Flash enrichment with web search grounding
- Artist filter fixed: proper `artist_id` field in FilterState, sidebar resets on language change
- Tooltip debounce fixed: 300ms hover dwell before fetch + show
- **Supabase migration complete** — `lib/db.ts` reads from Supabase; admin save/update routes write to Supabase; legacy JSON/CSV files and one-time migration scripts removed; only `data/controlled-vocab.json` remains as a reference doc
- Player seek sync fixed: `seekTo`/`seekMirror` use separate ref-callback pattern (`registerSeekFn`, `registerMirrorSeekFn`); no more drift between master PlayerBar and NowPlaying mirror
- **Karaoke mode** — mobile NowPlaying sheet is always full-height; 🎤/↓ button in title row toggles embed visibility and bumps lyrics to `text-xl`; lyrics/notes tabs unified into a single pill row
- **PWA back-button handling** — `history.pushState` when sheet opens, `popstate` listener closes it; `skipNextPop` ref prevents double-fire on programmatic close
- Artist duplicate cleanup in Supabase (檳榔兄弟, Haisul, 排灣女聲 deduped)
- `AGENTS.md` fully rewritten to reflect Supabase architecture, current player patterns, and component locations
- **Admin UI revamp** — unified Songs tab (list + inline edit form, replaces separate Browse/Add/Audit tabs); Metrics tab as default; global filter bar (language, artist, status, missing field) wired to all three tabs; artist options fetched dynamically per language/status selection
- **Admin multi-song add** — playlist and channel import via YouTube Data API v3 (full pagination); per-item inline edit form with metadata + lyrics sections; AI research per item or batch
- **Metadata pass 1** — oEmbed backfill: 72 `yt_title` and 15 `artist_credit` fields filled from YouTube oEmbed across all songs with a YouTube URL
- **Metadata pass 2** — Gemini 2.5 Pro web-search pass across all 84 songs: 68 modified (indigenous titles added, channel names corrected to artist names, Chinese titles filled, cluttered YouTube titles cleaned)

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

- [ ] **Sorting algorithm** — post-public-release: rank by a popularity × (info accuracy + completeness) matrix. Popularity = play count (see below); accuracy/completeness = derived from `verification_status`, `confidence`, and presence of lyrics/tags. Pre-launch default remains newest-first.
- [ ] **Play count tracking** — add `play_count` to `songs` table; increment via `POST /api/play/[id]` after 30s of continuous play (fired from PlayerContext); optimistic local increment for instant feedback; ISR handles display lag. Needed as input to the sorting matrix above.
- [ ] **Karaoke auto-scroll** — timed lyric highlighting for singing practice (requires timestamp data; basic karaoke mode already shipped)
- [ ] **Lyrics search** — full-text search returning songs that contain a given word or phrase (Supabase FTS)
- [ ] **Language toggle** — zh / en / ab display switch across the UI
- [ ] **OAuth** — replace hard-coded admin key with Supabase Auth
- [ ] **Save-artist duplicate guard** — check for existing `name_display` before INSERT in `/api/admin/save-artist` (rapid-fire clicks can create duplicates)

---

## Admin tooling

- [ ] Upgrade enrichment to Gemini 2.5 Pro for better accuracy
- [ ] Lyrics enrichment from song title or URL
- [ ] **Title discovery flow** — type a query (artist name, album, genre) → AI returns a list of N candidate songs → user selects which to import/research. Different from the current title-mode single-song lookup. Closest to the channel-import design note (see bottom). Defer until Phase 6 admin UI is stable.
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
