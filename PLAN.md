# PLAN.md — Formosan Echoes Roadmap

Living document. Update at the end of any session that completes a task or changes scope. **Agents: read this at the start of every session before advising on what is or isn't built.**

---

## Current state (as of 2026-05-23)

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
- **Admin artists view (May 2026)** — `ArtistsAdminView` replaces `ArtistAuditPanel`; full artist list with search/filter, inline edit form (three-script names, ethnic groups, bio, links, members), unlinked queue, Research with AI integration; `ArtistAuditPanel.tsx` deleted
- **Song–artist auto-linking (May 2026)** — `enrich-song` returns `artist_match` after DB lookup; on research completion, song is auto-linked via `song_artists` if a match is found; right panel shows green linked-artist chips with one-click unlink; `POST/DELETE /api/admin/link-song-artist` route added
- **Song delete** — red trashcan button in left rail; `DELETE /api/admin/delete-song` route; cascades clean up lyrics, song_artists, song_tags
- **Artist display homogenised** — all three artist display locations in SongsAdminView (left rail, batch rows, right panel header) now use `artist_display || artist_credit`; priority order is `ab > en > zh`
- **Bilingual UI (May 2026)** — custom i18n system: `LangProvider` in `lib/lang.tsx`, `useT()` / `useLang()` hooks, typed `LocaleStrings` interface enforced across `lib/locales/en.ts` and `lib/locales/zh.ts`; all user-visible strings in browser UI replaced with locale keys; Traditional Chinese and English fully translated
- **Lyrics swipe gestures** — swipe left/right on the lyrics area in NowPlaying cycles through lyric display modes (romanized / Chinese / English / notes)
- **Duplicate URL detection in Add Songs panel** — URLs already present in the DB are flagged at extraction time in AddMultipleSongsPanel; duplicate rows are visually marked before the user imports
- **Metrics dashboard visualizations** — segmented ring charts and triple-segment gap bars in MetricsPanel; fixed fill-% rendering (bars always correct color/length regardless of segment values)
- **Share feature (May 2026)** — `ShareModal` component with 6 social platforms (Instagram, Facebook, WhatsApp, X, Email, Reddit); `openShare()` in BrowserPage tries Web Share API first (native mobile sheet), falls back to modal; share buttons in: song context menu, NowPlaying title row, artist detail panel header, playlist rows in bookmark dropdown; deep links `/?song=<uuid>` / `/?artist=<uuid>` / `/?playlist=<uuid>` consumed once on mount and cleared; public playlist API route `GET /api/playlists/[id]` using anon Supabase client (requires RLS policy); lyrics text payload included in share when `show_publicly` is true
- **Analytics (May 2026, migrated to self-hosted Jul 2026)** — Umami, self-hosted on Vercel at `umami-ten-mocha.vercel.app` (moved off cloud.umami.is to avoid the 100K events/mo cap); cookie-free, no consent banner required; provider-agnostic `lib/analytics.ts` wrapper; 20 events instrumented: `song-play/pause/resume/skip/listen(30s+2min)`, `song-search`, `filter-*`, `tab-switch`, `artist-open`, `lyrics-mode`, `favorite-toggle`, `playlist-create/add-song`, `share`, `share-platform` (UTM source appended to all shared URLs), `deep-link`, `language-toggle`, `karaoke-toggle`, `sign-in`; reference doc at `docs/ANALYTICS.md`
- **Admin analytics tabs (May 2026)** — "Live" tab: Umami share URL embedded as full-height iframe (`NEXT_PUBLIC_UMAMI_SHARE_URL` env var, setup instructions shown if unset); "Analytics" tab: empty placeholder for future custom charts
- **OAuth / admin auth (already shipped)** — Google OAuth via Supabase Auth; `/login` page with Google sign-in server action; `app/admin/page.tsx` gate via `getUser()`; middleware blocks unauthenticated requests; `?key=654321` gate fully removed

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
- [x] **Play count tracking** — `play_count` on `songs` (weighted: +1 at 30s, +1 at 2min); `POST /api/play/[id]` calls `increment_play_count` RPC; fired fire-and-forget from PlayerContext listen timer.
- [ ] **Karaoke auto-scroll** — timed lyric highlighting for singing practice (requires timestamp data; basic karaoke mode already shipped)
- [x] **Lyrics search** — `/api/search-lyrics` with ilike across lyrics_original/zh/en + snippet extraction; search overlay mode toggle wired in BrowserPage
- [x] **Save-artist duplicate guard** — check for existing `name_display` before INSERT in `/api/admin/save-artist` (rapid-fire clicks can create duplicates)

---

## Admin panel improvements — see `docs/SONGS_TAB_AUDIT.md`

Full audit with gaps table and phased plan at `docs/SONGS_TAB_AUDIT.md`.

### Phase A — Bug fixes (in progress)
- [x] Load `lyrics_source` from DB in `draftFromSong()` (Gap #1)
- [x] Research All confirmation for >10 songs (Gap #2)
- [x] Re-populate form from server after save (Gap #5)
- [x] Manual "Link artist…" type-ahead picker in song edit form (Gap #4)

### Phase B — Artists tab homogenisation ✓
- [x] Left rail: **All | Unlinked** tabs inline left of the All/Individual/Groups toggle
- [x] Header card compact design matching Songs (close button, avatar, name, badges, meta row)
- [x] Batch research with progress bar + elapsed timer + confirmation guard for >10
- [x] Batch research now passes `link_song_id` to `save-artist` (was missing)
- [x] `stopBatch` extracted from inline click handler
- [x] Missing badges on artist rows already present (2 + `+N`) ✓
- [ ] Extract shared `<Field>` / `<SelectField>` subcomponents (deferred — no user-visible impact)

### Phase C — Bidirectional linking ✓
- [x] "Add song…" picker in artist detail panel — lazy-loads songs, type-ahead search, links via `link-song-artist`
- [x] Linked songs shown as chips with unlink buttons; optimistic count update on link/unlink
- [x] "↺ re-scan" button — `POST /api/admin/rescan-artist-songs` re-runs ilike alias scan for this artist only
- [x] Unlinked queue moved to Artists tab left-rail "Unlinked" tab (Phase B)

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

- [ ] **Player bar dismiss gesture** — add swipe-down on the NowPlaying sheet (or tap mini thumbnail to collapse) to close the PlayerBar without a cross button; options: swipe-down on sheet, drag handle affordance, tap thumbnail again to toggle. For now PlayerBar closes when mobile filter sidebar opens (already shipped).
- [ ] **Service worker** — add SW for consistent update behaviour; decision rationale in `docs/DECISIONS.md [PWA]`.

  Implementation plan:
  1. Register SW in `app/layout.tsx` (client component), pointing at `/sw.js`
  2. Place `sw.js` in `/public/` (Next.js will not serve it from `/app/`)
  3. Use `updateViaCache: 'none'` in `register()` to bypass HTTP cache on SW script fetch
  4. SW strategies: network-first for HTML navigation (ISR updates reach the user); cache-first for `/_next/static/**` (immutable hashed assets); pass-through for all cross-origin requests (YouTube, Supabase, Gemini)
  5. `self.skipWaiting()` in install handler; `self.clients.claim()` in activate handler

  Smoke tests (iOS first, then Android):
  - Install as PWA → force-close → reopen → confirm latest build (not stale shell)
  - Play a song start to finish → confirm no double-audio (SW must not intercept the audio stream)
  - Open a song with `show_publicly: true` lyrics → confirm lyrics appear; without → confirm they don't
  - Navigate to `/admin?key=654321` → confirm admin routes are not cached
  - Trigger a Vercel deploy mid-session → confirm new build visible within ~60 s (ISR window)

  Tradeoffs: SW lifecycle bugs (stuck "waiting", cache poisoning) are hard to debug remotely; iOS Safari has edge cases around install/update timing. Use Workbox rather than hand-rolling — it handles cache versioning and cleanup reliably.

- [ ] **Type cleanup** — remove `title_romanized`, `lyrics_romanized`, and other unpopulated legacy stubs from `lib/types.ts` `Song` interface; confirm nothing in the app reads them before deleting
- [ ] Dialect sub-tags
- [ ] Contributor system — user-submitted songs with moderation queue
- [ ] Lyrics correction workflow
- [ ] Artist pages
- [ ] Collection / label pages
- [ ] Animated PWA launch — fake splash screen (full-screen overlay, CSS/Framer Motion on logo SVG, fades out once app is ready; `sessionStorage`-gated so it only plays on first open per session, not every navigation)

---

## Contributor system — multi-user data review

For collaborators who will co-review and curate song/artist data using their own Google accounts.

### Design decisions

- **Two roles: `admin` vs `contributor`.** Admins have full access. Contributors can edit metadata and move songs to `checked`, but cannot set `show_publicly: true` on lyrics or promote songs to `approved_public`. This prevents unilateral publication of sensitive lyric content.
- **Roles stored in a `user_roles` Supabase table** (keyed by `user_id` from Supabase Auth), not env vars. Env vars don't scale past a handful of people and require a redeploy to change.
- **Audit trail on songs**: add `reviewed_by` (email) and `reviewed_at` (timestamp) columns. Lightweight — no full revision history needed yet. Makes it clear whether a `checked` status came from a core team member or a new contributor.
- **Status promotion rules** (enforced in API routes, not just UI):
  - Anyone with access can move a song to `needs_review` or `checked`
  - Only `admin` can promote to `approved_public` / `approved_private`
  - Only `admin` can set `lyrics.show_publicly = true`
  - Only `admin` can delete songs or artists

### Implementation phases

- [ ] **Phase 1 — Roles table + API enforcement**
  - `user_roles` table: `(user_id uuid, role text)` — `admin | contributor`
  - Helper `getUserRole(supabase)` server-side utility
  - Gate `show_publicly`, `approved_public`, delete-song, delete-artist routes behind `admin` check
  - Seed initial admin rows for existing team members

- [ ] **Phase 2 — Audit trail**
  - Add `reviewed_by text` and `reviewed_at timestamptz` to `songs`
  - Write these fields on any save where `verification_status` changes
  - Show `reviewed_by` + `reviewed_at` in the song edit panel header

- [ ] **Phase 3 — Contributor-scoped UI**
  - Contributors see the Songs and Artists tabs, but not Metrics / Analytics / Live tabs
  - Lyric publish toggle and status promotion controls hidden (not just disabled) for contributors
  - "Checked queue" view: filter to songs a contributor has moved to `checked`, awaiting admin sign-off

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
