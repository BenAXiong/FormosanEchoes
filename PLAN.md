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
- **Admin song editor revamp (May 2026)** — full series of fixes and improvements to `SongsAdminView`:
  - `title_original` Chinese guard (`hasChinese()`) — AI can no longer put Chinese characters in the indigenous title field; they fall through to `title_zh` instead
  - `title_original` sentence-case instruction added to Gemini system prompt
  - `title_chinese` constraint: official sources only, no AI translations, no genre descriptors
  - Research button state machine: idle (violet) → researching (red Stop) → complete (blue "review & save")
  - Non-YouTube URL field: strips YouTube URLs on load (they belong in `yt_url`)
  - `artist_display` field: resolved "EnglishName - 中文名" format computed server-side from `song_artists` join, displayed in song card header
  - Song card header redesign: compact, icon buttons (YouTube link, artist search), truncated title/artist text with ellipsis, max 1 missing badge shown
  - Notes field moved to top of both Metadata and Lyrics tabs
  - Form field reorder: Non-YouTube URL in left col; Language moved to right col position 2
  - Grounding sources returned as `{ url, title }` — human-readable source titles shown as pills
  - First grounding source `title` promoted to `lyrics_source` when AI gives generic attribution
  - `[not found — AI date]` sentinel: now reliably written when AI finds no lyrics (was previously blocked by a fallback `lyrics_source` value overwrite)
  - Three save paths audited — lyrics_source sentinel wiring verified across all three
  - Research merge: base is now current `draft` (not DB-fresh `draftFromSong`) — manual edits survive re-research; corrected `artist_credit` and titles are sent to AI as context
  - "Saved" row removed (redundant with button state); `setPanelMessage('')` on save

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
- [ ] Animated PWA launch — fake splash screen (full-screen overlay, CSS/Framer Motion on logo SVG, fades out once app is ready; `sessionStorage`-gated so it only plays on first open per session, not every navigation)

---

## Post-publish — Indigenous Music Brain

The accumulated corpus (songs, verified lyrics, artist bios, cultural tags, language labels) can be turned into a self-reinforcing knowledge system where each new piece of content is assessed using everything already known.

### What this means in practice

**RAG-augmented research** — instead of relying purely on Google Search grounding, inject verified DB content directly into the Gemini prompt: songs by the same artist, lyrics in the same language, bios of related artists. The artist context injection shipped today is the first step; the full version would pull semantically similar songs too.

**Embedding store** — add `pgvector` to Supabase; embed lyrics, bios, and song descriptions. Enables:
- Similarity search ("find songs that sound like / are about the same thing as X")
- Duplicate/cover detection ("this new song's lyrics are 80% similar to an existing entry")
- Dialect fingerprinting ("this lyric pattern matches Bunun southern dialect")

**Progressive trust** — verified songs and artists raise confidence on newly linked content. An artist with a confirmed bio and 10 verified songs provides strong prior for new songs attributed to them. Confidence scores flow through the graph.

**Cultural context documents** — one curated document per ethnic group (ceremonies, musical traditions, common themes, key vocabulary) injected into AI prompts. Curation is manual once, then reused forever; AI research for that group gets meaningfully sharper.

**Lyrics corpus → language resource** — the verified indigenous-language lyrics could become one of the only structured NLP training sets for several of these 16 languages. Even a small high-quality corpus has outsized value for communities where almost no digital language data exists. Requires explicit community consent and licensing decisions before any external release.

### Architecture path

1. `pgvector` extension on Supabase (free tier supports it)
2. Embed on save: run text through an embedding model (Gemini `text-embedding-004`, free tier) whenever a song or artist is saved with new verified content
3. Similarity endpoint: `GET /api/similar-songs?song_id=X` returns nearest neighbours by cosine distance
4. Feed into enrich-song: top 3 similar verified songs injected as context
5. Cultural context docs: a new `ethnic_group_context` table, one row per group, edited via admin

### Sensitivity note

Some ceremonial songs are not meant for general circulation or AI training. The `verification_status` + `show_publicly` gate already exists; extend it with a `ceremonial_restricted` flag before opening the corpus to any external use.
