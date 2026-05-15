# DECISIONS.md — Architecture Decision Records

Every non-obvious choice lives here: what we chose, why, and what we rejected.
Add a new entry any time we make a call that a future agent might re-litigate.

Format:
```
## [AREA] Short title
**Chosen:** …
**Why:** …
**Rejected:** …
**Date:** YYYY-MM-DD
```

---

## [DATA] JSON files over a database (for now)

**Chosen:** `data/songs.json` and `data/artists.json` as the source of truth.

**Why:** The prototype needed to move fast. JSON is directly editable, readable in git diff, and trivially deployable on Vercel without any external service. The dataset is small enough (~400 songs, ~100 artists) that flat-file reads are instant.

**Rejected:** Supabase at this stage. It adds auth, connection pooling, and migration overhead before we know the schema is stable. The schema *will* change (title fields, awards, performance style, dialect tags are all pending).

**When to revisit:** When the batch import pipeline runs and the song count grows into the thousands, or when multi-user admin becomes necessary. See PLAN.md.

**Date:** 2026-05-15

---

## [DATA] Keep raw `artist` string alongside resolved `artist_ids`

**Chosen:** Songs carry both `artist` (raw string from source) and `artist_ids` (array of resolved IDs into `artists.json`).

**Why:** `artist` is the original string from the data source — it reflects how the artist is credited on the recording. It must not be overwritten by our internal ID system. `artist_ids` is derived at build time by the linker script and can be regenerated at any time. If a song's artist can't be linked, we still have a human-readable name.

**Rejected:** Storing only `artist_ids` and discarding the raw string. That would make unlinked songs display nothing, and would lose provenance.

**Implication:** Do not use `artist_ids` as the display string — always render `song.artist` for display, using `artist_ids` only to resolve to a full `Artist` record for richer metadata.

**Date:** 2026-05-15

---

## [DATA] Three separate title fields, not a language-keyed map

**Chosen:** `title_original`, `title_romanized`, `title_chinese` as distinct named fields.

**Why:** Each field has a distinct role and display priority. `title_original` is the authoritative indigenous-script name. `title_romanized` is the pronunciation guide for learners. `title_chinese` is the common name used in mainstream media. They are not interchangeable and the priority order matters: original > romanized > Chinese for display (`getDisplayTitle` in `lib/normalize.ts`).

**Rejected:** A `titles: { [lang: string]: string }` map. That loses the semantic distinction between these three specific roles and makes priority ordering implicit.

**Date:** 2026-05-15

---

## [DATA] `language_claimed` vs `language_evidence` as separate fields

**Chosen:** Explicit claim/evidence split for language and ethnic group on every song.

**Why:** Cultural and academic integrity. An artist's ethnic background does not prove the language of the song. A YouTube playlist label is weak evidence. A lyrics source in the language is strong evidence. By separating claim from evidence, a reviewer can assess confidence independently. An AI should never collapse these into a single field.

**Rejected:** A single `language` field. Too easy to mix inferred values with sourced values, leading to unchecked overclaiming.

**Implication:** When Gemini enriches a song, it must populate both fields. When displaying, always show the evidence alongside the claim in the admin panel.

**Date:** 2026-05-15

---

## [DATA] Two axes: `confidence` (epistemic) vs `verification_status` (workflow)

**Chosen:** Both fields exist on every song and mean different things.

- `confidence`: How sure are we the data is correct? (`high | medium | low | unknown`)
- `verification_status`: What has been done with this song in the curation workflow? (`candidate | needs_review | checked | approved_public | approved_private | rejected | duplicate`)

**Why:** A song can be `confidence: low` and `verification_status: checked` — meaning we looked at it and it's genuinely uncertain (not a failure, just honest). A song can be `confidence: high` and `verification_status: candidate` — it just hasn't been through the approval workflow yet. Collapsing these would lose this distinction.

**Rejected:** A single `status` field. Would force a combined meaning that breaks the ability to track epistemic uncertainty separately from curation state.

**Date:** 2026-05-15

---

## [DATA] `lyrics.show_publicly` as display gate, separate from `lyrics.has_permission`

**Chosen:** Two boolean flags, not one.

- `has_permission`: Do we have rights to use these lyrics?
- `show_publicly`: Should they be shown to anonymous visitors right now?

**Why:** They are orthogonal concerns. We might have permission but choose not to display until a human review is done. We might have a note about lyrics without permission and want to record that without ever displaying it. The render gate is always `show_publicly`, not `has_permission`.

**Rejected:** A single `is_public` flag. Loses the rights-tracking information needed for legal compliance.

**Implication:** Render code must check `lyrics?.show_publicly === true`. Never render lyrics content if this is `false` or `undefined`, even if `has_permission` is `true`.

**Date:** 2026-05-15

---

## [DATA] Conservative normalization defaults in `normalizeSong`

**Chosen:** Missing `confidence` defaults to `'unknown'`. Missing `verification_status` defaults to `'candidate'`. Missing `needs_manual_verification` defaults to `true`.

**Why:** Fail-safe toward caution. A song with no confidence set should not appear to be verified. A song with no status set should not appear approved. The defaults ensure that raw data that arrives with missing fields enters the workflow at the most conservative point.

**Rejected:** Defaulting to `'medium'` confidence or `'checked'` status. That would silently promote unverified data.

**Date:** 2026-05-15

---

## [DATA] ID formats: `sof-NNNNN` for songs, `art-NNN` for artists

**Chosen:** Sequential prefixed IDs (e.g., `sof-00001`, `art-001`).

**Why:** Human-readable in JSON, stable across sessions, easy to type in search/debug, and avoids UUID verbosity for a small dataset. The `sof-` prefix namespaces song IDs if they ever coexist with other ID spaces.

**Rejected:** UUIDs. Overkill for a dataset this size, impossible to read in raw JSON.

**When to revisit:** If migrating to Supabase, the DB will generate its own PKs. At that point, keep these IDs as `slug` fields for URL-friendliness.

**Date:** 2026-05-15

---

## [DATA] UTF-8, CJK characters stored as literal Unicode (not escaped)

**Chosen:** JSON files store `"馬蘭姑娘"` not `"馬蘭姑娘"`.

**Why:** The files must be readable and editable by humans (and AI agents) without a decode step. Git diffs are legible. Source review is practical.

**Rejected:** Unicode escape sequences. They are unreadable and unnecessary — Node.js, browsers, and all relevant tooling handle UTF-8 natively.

**Implication:** Any script that writes to these JSON files must use `JSON.stringify` with no ASCII-only flag. In Node.js: `JSON.stringify(data, null, 2)` (default behavior is correct — do NOT pass `{ escapeUnicode: true }` or equivalent).

**Date:** 2026-05-15

---

## [FILTERS] `FilterState` has both `ethnic_group` and `artist_id`

**Chosen:** Two separate filter fields:
- `ethnic_group: string` — filters by `song.ethnic_group_claimed` (exact match). Used by the admin `FilterBar`.
- `artist_id: string` — filters by membership in `song.artist_ids`. Used by the demo `DemoFilterSidebar`.

**Why:** The original prototype only had `ethnic_group` and repurposed it in the demo sidebar to hold an artist ID. This broke both: `filterSongs` was checking `artist_ids` instead of `ethnic_group_claimed` (wrong for admin), and the field name was semantically wrong (confusing for the demo). The fix was to restore `ethnic_group` to its correct meaning and add a separate `artist_id` field.

**Rejected:** Renaming `ethnic_group` to `artist_id` entirely — that would have broken the admin `FilterBar` which legitimately filters by ethnic group.

**Implication:** When the demo sidebar's language filter changes, it must also reset `artist_id` to `''` (an artist from the previous language pool would silently zero out results).

**Date:** 2026-05-15

---

## [FILTERS] AND logic for all active filters

**Chosen:** Every active filter must match. A song is shown only if it passes all filters simultaneously.

**Why:** More precise results. Users can always relax filters by clearing them. AND logic is predictable — OR logic across multiple filter types produces unintuitive result explosions.

**Rejected:** OR logic across filter types (e.g., show songs that match language OR artist OR tag). That's useful for some search UIs but wrong for a faceted browser.

**Date:** 2026-05-15

---

## [FILTERS] `has_lyrics: boolean | null` tri-state

**Chosen:** `null` means "no filter on lyrics presence". `true` means "must have public lyrics". `false` means "must not have public lyrics".

**Why:** A separate `has_lyrics_filter_active: boolean` flag would be redundant. Tri-state encodes all three cases cleanly. `null` is the "off" state, avoiding the need to track filter activation separately.

**Rejected:** A boolean with a separate activation flag. More state to manage, more ways to get out of sync.

**Date:** 2026-05-15

---

## [PLAYER] Hidden master audio + muted visual mirror

**Chosen:** One `ReactPlayer` instance lives inside `PlayerBar` (always mounted, 1×1px, handles actual audio). `DemoNowPlaying` contains a second `ReactPlayer` that is always muted — it mirrors the current song for visual display only.

**Why:** A single audio source prevents double-playback. The visual embed in the detail panel shows the YouTube video frame while `PlayerBar` controls the actual audio. This gives the feel of a unified player without complex cross-component audio routing.

**Rejected:** Moving the ReactPlayer into `DemoNowPlaying` and having `PlayerBar` reference it via a ref. Component lifetime issues: the detail panel can unmount, which would kill audio. The fixed bottom bar never unmounts, making it the correct home for persistent audio.

**Implication:** `DemoNowPlaying`'s player must always have `muted={true}`. `PlayerBar`'s player must never be muted. If you see audio doubling, a component is wrongly creating a non-muted player outside of `PlayerBar`.

**Date:** 2026-05-15

---

## [PLAYER] Global player state in React Context (not Zustand/Jotai)

**Chosen:** `lib/PlayerContext.tsx` — standard React context with `useMemo` on the value object.

**Why:** The app is small enough that context re-render overhead is acceptable. Adding a state management library (Zustand, Jotai, Redux) before the schema stabilizes adds migration cost with no clear benefit yet.

**When to revisit:** If the context causes measurable re-render problems (e.g., every song card re-renders on progress tick). At that point, split progress/duration into a separate context or move to Zustand.

**Date:** 2026-05-15

---

## [PLAYER] localStorage keys prefixed `sof-`

**Chosen:** `sof-favorites`, `sof-playlists`.

**Why:** Avoids collision with other apps running on localhost. `sof` = "Songs of Formosa" (internal working name before "Echoes" branding).

**Date:** 2026-05-15

---

## [BUILD] Artist linker runs at `prebuild` (not at request time)

**Chosen:** `scripts/link-artists.js` runs automatically before every `next build`. Also exposed as `npm run link` for manual use.

**Why:** Artist resolution is expensive to run on every request (reads and writes JSON files). It only needs to run when data changes. Build-time execution is a clean checkpoint.

**Rejected:** Running the linker in `getSongs()` or in a Next.js middleware. That would make it run on cold-start and interfere with concurrent requests.

**Implication:** After editing `songs.json` or `artists.json`, always run `npm run link` before testing artist filter behavior. The dev server does not re-run the linker automatically.

**Date:** 2026-05-15

---

## [ADMIN] Admin route gated by `?key=654321` query parameter

**Chosen:** Simple query-string secret checked in the admin page component.

**Why:** Fast placeholder. No user accounts exist yet, and Vercel deployments are not public-facing. This is enough to prevent casual access during the prototype phase.

**Rejected:** Real auth at this stage. OAuth setup (NextAuth, Clerk, etc.) adds significant overhead before the core product is stable.

**When to replace:** Before any public demo deployment or when a second admin user needs access. See PLAN.md (OAuth item).

**Do not:** Make the key configurable from an env var without also making it non-guessable. `654321` is a placeholder, not a secret.

**Date:** 2026-05-15

---

## [ADMIN] Gemini 2.5 Flash for enrichment (not Pro)

**Chosen:** `gemini-2.5-flash` in `/api/admin/enrich-song`.

**Why:** Flash is fast enough for interactive use (admin waits for the result) and cheap enough for frequent calls during bulk data entry. Pro-level reasoning is not needed for structured metadata extraction from song titles + YouTube context.

**When to upgrade:** When the batch import pipeline needs to process hundreds of songs autonomously and accuracy on ambiguous cases becomes the bottleneck. Upgrade to `gemini-2.5-pro` at that point.

**Date:** 2026-05-15

---

## [DEV] Dev server on port 3002

**Chosen:** `--port 3002` in the `dev` script.

**Why:** Avoids collisions with other local projects running on the default 3000 or 3001.

**Date:** 2026-05-15
