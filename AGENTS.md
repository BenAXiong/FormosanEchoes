<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Formosan Echoes — Agent Guide

## What this project is

A curated browser for Formosan-language (Indigenous Taiwanese) music. Public demo at `/`; admin curation panel at `/admin?key=654321`. The roadmap and current state live in `PLAN.md`.

## Data architecture

All data is file-based JSON — no database yet:

| File | Role |
|---|---|
| `data/songs.json` | Master song catalog (~400+ records) |
| `data/artists.json` | Artist profiles (~100 entries) |
| `data/artists_unlinked.json` | Artist strings that couldn't be auto-linked |
| `data/controlled-vocab.json` | Canonical values for languages, tags, confidence, status |

**Artist linking** is a build-time step (`scripts/link-artists.js`, also `npm run link`). It resolves `song.artist` strings to `artist_ids` arrays. It is idempotent — safe to re-run at any time. Always re-run it after editing `songs.json` or `artists.json`.

## Key code locations

| Concern | File |
|---|---|
| All TypeScript types | `lib/types.ts` |
| Song loading + normalization | `lib/data.ts`, `lib/normalize.ts` |
| Search | `lib/search.ts` |
| Filtering | `lib/filters.ts` |
| Artist resolution | `lib/artists.ts` |
| Data validation | `lib/validate.ts` |
| Global player state | `lib/PlayerContext.tsx` |
| Public demo page | `app/page.tsx` |
| Admin panel | `app/admin/CurationView.tsx` |
| Gemini enrichment API | `app/api/admin/enrich-song/route.ts` |

## Critical rules

**Types**: Always use types from `lib/types.ts`. Do not define ad-hoc inline types.

**Lyrics rights**: `lyrics.show_publicly` is the display gate — never render lyrics content unless this is `true`. Do not default it to true. Also respect `lyrics.has_permission` and `lyrics.lyrics_rights_status`.

**Controlled vocabulary**: `confidence` and `verification_status` must only use values from `data/controlled-vocab.json`. Do not invent new values.

**Player architecture**: The actual audio lives in the hidden ReactPlayer inside `PlayerBar`. The embed in `DemoNowPlaying` is a **muted mirror** for visual sync only. All playback state goes through `usePlayer()` from `PlayerContext`.

**Filter key inconsistency**: The `ethnic_group` filter key in `FilterState` is currently repurposed as an artist_id filter. This is a known bug listed in `PLAN.md`. Do not work around it by adding more workarounds — fix the root cause.

## Before modifying data files

- After any edit to `songs.json` or `artists.json`, run `npm run link` to refresh `artist_ids`
- Check the dev console for validation warnings from `lib/validate.ts`
- The admin panel writes new songs via `/api/admin/save-song` — prefer that path for adding songs programmatically

## Dev server

Runs on **port 3002** (`npm run dev`).

## Environment variables

```env
GEMINI_API_KEY=...        # Required for admin enrichment
YOUTUBE_API_KEY=...       # Optional — YouTube description/comments during enrichment
PORTAL_URL=...            # Dictionary API endpoint
```

## Admin panel security

The admin panel is gated by `?key=654321` — a placeholder until OAuth is implemented. Do not remove or circumvent this check. Do not expose the key in client-side bundle code.

---

## Traps — things an AI will naturally get wrong here

These are the decisions most likely to be "fixed" incorrectly by a well-meaning agent. Read before touching any of these areas.

**`FilterState` has two distinct filter fields: `ethnic_group` and `artist_id`.**
- `ethnic_group` filters by `song.ethnic_group_claimed` — used by the admin `FilterBar`.
- `artist_id` filters by membership in `song.artist_ids` — used by the demo `DemoFilterSidebar`.
Do not conflate them. The original prototype incorrectly reused `ethnic_group` for artist filtering; that bug has been fixed. See `docs/DECISIONS.md` for the full history.

**The muted mirror embed must stay muted.**
`DemoNowPlaying` contains a `ReactPlayer` that is always `muted={true}`. This is intentional — actual audio comes from the hidden player in `PlayerBar`. If you add a new player component and forget `muted`, the user will hear double audio. There must be exactly one non-muted `ReactPlayer` in the app, and it lives in `PlayerBar`.

**Do not default `lyrics.show_publicly` to `true`.**
When generating or normalizing lyrics data, always leave `show_publicly: false` unless there is an explicit rights decision. The validator warns on public lyrics without a `lyrics_rights_status`. Gemini-enriched lyrics arrive with `show_publicly: false` and must be manually approved.

**`artist` and `artist_ids` both exist on purpose.**
Do not delete `song.artist` after linking. Do not display `artist_ids` directly to users — resolve them to `Artist` records via `getArtistById` in `lib/artists.ts`. Do not manually edit `artist_ids` in JSON — they are regenerated by the linker script.

**Run `npm run link` after any data edit.**
The dev server does not re-run the linker. If you add a song or edit an artist's name variants and skip this step, `artist_ids` will be stale and artist filters will silently break.

**JSON encoding: no escaped Unicode.**
When writing to `songs.json` or `artists.json` from a script, use `JSON.stringify(data, null, 2)` with no additional options. Do not pass any flag that converts CJK characters to `\uXXXX` escapes. The files must remain human-readable.

**`confidence` and `verification_status` are different axes.**
`confidence` is epistemic (how certain is the data). `verification_status` is workflow (what has been done). Do not conflate them. A checked entry can still be low-confidence. An unreviewed entry can have high confidence. See `docs/DECISIONS.md` for the full reasoning.

**`title_original` is not always the indigenous-script title.**
Some songs only have a Chinese or romanized title. `title_original` is populated with whatever the "most original" available title is — which may be Chinese if no indigenous-script form is known. The upcoming schema change (PLAN.md) will formally split this into `title_original` (script) and `title_name` (common name). Do not assume `title_original` is always indigenous script.

**`language_claimed` values must match `controlled-vocab.json`.**
Do not invent values like `"Pangcah"` or `"Formosan"`. The vocab has `"Amis"` for Amis/Pangcah. Inconsistent values silently break language filters.

**Keep PLAN.md current.** Update it whenever a significant task is completed or a decision changes scope. Mark items done, add new items as they emerge. Do this at the end of any session that changes the architecture or completes a feature.

**Docs to read before non-trivial changes:**
- `docs/DECISIONS.md` — why things are the way they are
- `docs/DATA_SCHEMA.md` — field-by-field reference and encoding rules
- `PLAN.md` — current state and upcoming work
- `notes/artist_research_coverage.md` — artist linking status and gaps
