<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Formosan Echoes — Agent Guide

## What this project is

A curated browser for Formosan-language (Indigenous Taiwanese) music. Public browser at `/`; admin curation panel at `/admin?key=654321`. The roadmap and current state live in `PLAN.md`.

## Data architecture

**Supabase (PostgreSQL)** is the source of truth. `data/controlled-vocab.json` is the only remaining file in `data/` — it is a reference document for valid `confidence` and `verification_status` values, not imported at runtime.

| Table | Role |
|---|---|
| `songs` | Master song catalog |
| `song_artists` | Many-to-many: song ↔ artist |
| `lyrics` | One-to-one with songs; gated by `show_publicly` |
| `tags` + `song_tags` | Tag vocabulary + song assignments |
| `artists` | Artist profiles |
| `artist_names` | Name aliases per artist (script-tagged) |
| `artist_members` | Group membership (artist ↔ member artist) |

Server-side data access is in `lib/db.ts` — `getSongs()` and `getArtists()`. Never import `lib/db.ts` in client components. The Supabase client factory is in `lib/supabase.ts`.

The public page uses ISR (`export const revalidate = 60` in `app/page.tsx`) — new data appears within 60 seconds.

## Key code locations

| Concern | File |
|---|---|
| All TypeScript types | `lib/types.ts` |
| Supabase data access | `lib/db.ts` |
| URL normalization / title display | `lib/normalize.ts` |
| Search | `lib/search.ts` |
| Filtering | `lib/filters.ts` |
| Artist helpers | `lib/artists.ts` |
| Global player state | `lib/PlayerContext.tsx` |
| Public browser page | `app/page.tsx` |
| Browser UI (songs, filters, NowPlaying) | `components/browser/` |
| Player bar (audio master) | `components/PlayerBar.tsx` |
| Admin panel | `app/admin/CurationView.tsx` |
| Admin songs view (list + edit form) | `components/admin/SongsAdminView.tsx` |
| Admin multi-song add | `components/admin/AddMultipleSongsPanel.tsx` |
| Admin metrics | `components/admin/MetricsPanel.tsx` |
| Admin artist audit | `components/admin/ArtistAuditPanel.tsx` |
| Gemini enrichment API | `app/api/admin/enrich-song/route.ts` |
| Song save/update APIs | `app/api/admin/save-song/`, `app/api/admin/update-song/` |

## Critical rules

**Types**: Always use types from `lib/types.ts`. Do not define ad-hoc inline types.

**Lyrics rights**: `lyrics.show_publicly` is the display gate — never render lyrics content unless this is `true`. Do not default it to `true`. Gemini-enriched lyrics arrive with `show_publicly: false` and must be manually approved in the Song Audit panel.

**Controlled vocabulary**: `confidence` and `verification_status` must only use values from `data/controlled-vocab.json`. Do not invent new values.

**Player architecture**: The actual audio lives in the hidden ReactPlayer inside `PlayerBar` (1×1px, always mounted). The embed in `NowPlaying` (`components/browser/NowPlaying.tsx`) is a **muted mirror** — visual sync only. All playback state goes through `usePlayer()` from `PlayerContext`. There must be exactly one non-muted `ReactPlayer` in the app, and it lives in `PlayerBar`.

**Seek sync pattern**: `PlayerContext` exposes `seekTo` (seeks the master audio) and `seekMirror` (seeks the visual embed). They are kept separate to avoid feedback loops. `NowPlaying` registers its `playerRef.seekTo` via `registerMirrorSeekFn`. `PlayerBar` calls `seekMirror` only on `onPointerUp` (not on every `onChange` tick) to avoid flooding YouTube with seek requests.

**Panel open/close**: `PlayerContext` exposes `togglePanel` / `registerTogglePanelFn` — the same ref-callback pattern as seekMirror. `BrowserPage` registers `() => setSelected(...)` so the `PlayerBar` thumbnail tap can toggle the NowPlaying panel without prop drilling. Do not bypass this by adding new props or refs.

**NowPlaying dual-mount guard**: On desktop, `BrowserPage` renders NowPlaying inside the right panel. On mobile, a full-screen bottom sheet. To prevent both from mounting simultaneously (which would overwrite `mirrorSeekFnRef`), the mobile sheet is gated by `!isLargeScreen`. Do not remove this guard.

**Admin panel security**: Gated by `?key=654321` — placeholder until OAuth. Do not remove or expose the key in client-side bundle code.

---

## Traps — things an AI will naturally get wrong here

**The muted mirror embed must stay muted.**
`NowPlaying` (`components/browser/NowPlaying.tsx`) contains a `ReactPlayer` that is always `muted={true}`. If you add a new player component and forget `muted`, the user will hear double audio.

**Do not default `lyrics.show_publicly` to `true`.**
When generating or normalizing lyrics data, always leave `show_publicly: false`. The admin Song Audit panel is the only place this should be set to `true`.

**`artist` and `artist_ids` both exist on purpose.**
Do not delete `song.artist` (raw display string). `artist_ids` resolves to full `Artist` records. Do not display `artist_ids` directly to users.

**`FilterState` has two distinct filter fields: `ethnic_group` and `artist_id`.**
- `ethnic_group` — filters by `song.ethnic_group_claimed` (admin FilterBar).
- `artist_id` — filters by `song.artist_ids` membership (public FilterSidebar).
Do not conflate them. See `docs/DECISIONS.md` for history.

**`confidence` and `verification_status` are different axes.**
`confidence` is epistemic (how certain is the data). `verification_status` is workflow state. A checked entry can still be low-confidence.

**`title_original` is not always the indigenous-script title.**
Some songs only have a Chinese or romanized title. `title_original` is whatever the "most original" available title is. Do not assume it is always indigenous script.

**`language` values must match `data/controlled-vocab.json`.**
Do not invent values like `"Pangcah"` or `"Formosan"`. The vocab has `"Amis"` for Amis/Pangcah. Inconsistent values silently break language filters.

**Keep PLAN.md current.** Update it whenever a significant task is completed or a decision changes scope.

**Docs to read before non-trivial changes:**
- `docs/DECISIONS.md` — why things are the way they are
- `docs/DATA_SCHEMA.md` — field-by-field reference
- `PLAN.md` — current state and upcoming work
