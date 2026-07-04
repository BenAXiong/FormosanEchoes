# Hover Definition Tooltips — Feature Guide

This document explains exactly how the word-hover dictionary tooltip feature works in Formosan Echoes, so another agent can reproduce or extend it.

---

## What it does

When a user hovers over any word in the romanized lyrics panel, a tooltip appears after a 300 ms dwell showing the word's Chinese translation(s) and the dialect(s) it belongs to. The data comes from a separate project — **YCM Citadel** — via a lightweight proxy API route in Echoes.

---

## Architecture overview

```
NowPlaying.tsx
  └─ <RomLyrics> splits lyrics text → one <HoverableWord> per token
       └─ onMouseEnter → debounce 300ms → fetch /api/dict?q=<word>&dialects=<list>
            └─ app/api/dict/route.ts (Echoes proxy)
                 └─ fetch ${PORTAL_URL}/api/search?mode=DICT&q=<word>&dialects=<list>
                      └─ YCM Citadel — SQLite DB query → returns { results: [...] }
```

No Supabase is involved in the dictionary lookup. Citadel runs its own SQLite database.

---

## Files in Echoes

### `components/browser/HoverableWord.tsx`

The entire client-side component. Responsibilities:
- Splits nothing — receives a single `word` string (caller splits by space)
- Strips leading/trailing punctuation and lowercases before lookup (`cleanWord`)
- Skips words shorter than 2 characters
- Computes tooltip position from `getBoundingClientRect()` — shows **below** if the word is within 220 px of the viewport top, **above** otherwise
- 300 ms `setTimeout` before fetch to avoid flashing on fast cursor passes
- 220 ms hide delay so the user can move the cursor onto the tooltip itself without it closing
- Caches: once fetched (`fetched.current = true`), does not re-fetch on subsequent hovers
- Maps `language` prop → comma-separated dialect names via `LANG_TO_DIALECTS` before sending to the API

Key interfaces:
```typescript
interface DictEntry {
  ab: string;           // indigenous script form
  zh: string;           // Chinese translation
  dialect_name: string; // e.g. "南勢阿美語"
}

interface TooltipPos {
  top?: number;    // fixed px from viewport top  (below placement)
  bottom?: number; // fixed px from viewport bottom (above placement)
  left: number;
}
```

Dialect map (full list is in the file):
```typescript
const LANG_TO_DIALECTS: Record<string, string> = {
  'Amis':   '南勢阿美語,秀姑巒阿美語,海岸阿美語,馬蘭阿美語,恆春阿美語',
  'Atayal': '賽考利克泰雅語,澤敖利泰雅語,...',
  // 16 languages total
};
```

The tooltip renders at most 6 entries (`entries.slice(0, 6)`), 240 px wide (`w-60`), `max-h-44` with internal scroll.

### `app/api/dict/route.ts`

A thin proxy. It:
1. Validates `q` is at least 2 characters
2. Forwards to `${PORTAL_URL}/api/search?mode=DICT&q=...&dialects=...`
3. Caches the upstream response for 300 seconds via Next.js `{ next: { revalidate: 300 } }`
4. Returns `{ results: [] }` (never throws to the client) if Citadel is offline

```typescript
const PORTAL_URL = process.env.PORTAL_URL ?? 'https://ycm-citadel.vercel.app';
```

`PORTAL_URL` is optional in `.env.local` — it defaults to the live Citadel deployment.

### `components/browser/NowPlaying.tsx`

The `RomLyrics` helper (lines 14–26) handles the split and render:

```tsx
function RomLyrics({ text, language, large }: { text: string; language?: string | null; large?: boolean }) {
  return (
    <div className={`leading-loose ${large ? 'text-xl text-center' : 'text-sm'}`}>
      {text.split('\n').map((line, li) => (
        <div key={li} className="min-h-[1.5rem]">
          {line.split(' ').filter(Boolean).map((word, wi) => (
            <HoverableWord key={wi} word={word} language={language} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

`RomLyrics` is used in three lyric display modes: `original` (romanized only), `side` (two-column romanized + Chinese), and `seq` (interleaved line-by-line). In all cases `language={song.language_claimed}` is passed so the dialect filter is applied automatically.

---

## The Citadel side — `GET /api/search?mode=DICT`

Citadel is a separate Next.js app with a SQLite database. The relevant tables for DICT mode are:

| Table | Role |
|---|---|
| `ilrdf_vocabulary` | Headword dictionary: `word_ab`, `word_ch`, `dialect_name`, `glid`, `source` |
| `sentences` + `occurrences` | Example sentences — fetched alongside headwords but only `ab`/`zh`/`dialect_name` are used by Echoes |

**DICT mode query flow:**

1. FTS5 (`ilrdf_vocabulary_fts`) if query is Latin script — falls back to B-tree LIKE if FTS fails
2. Filters by `dialects` param (comma-separated `dialect_name` values) when provided
3. Orders by exact match first, then ascending length (`ORDER BY (ab = ?) DESC, LENGTH(ab) ASC`)
4. Returns up to 50 headwords, each with up to 10 example sentences attached

**Response shape** (each item in `results`):
```json
{
  "ab": "pasiwali",
  "zh": "迎靈祭歌",
  "dialect_name": "南勢阿美語",
  "glid": "...",
  "source": "...",
  "examples": [...]
}
```

Echoes only reads `ab`, `zh`, and `dialect_name` from each result — the rest is ignored by `HoverableWord`.

---

## How to reproduce this in another app

### Step 1 — Proxy route

Create `app/api/dict/route.ts`:

```typescript
import { NextResponse } from 'next/server';

const PORTAL_URL = process.env.PORTAL_URL ?? 'https://ycm-citadel.vercel.app';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const dialects = searchParams.get('dialects') ?? '';
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    let url = `${PORTAL_URL}/api/search?mode=DICT&q=${encodeURIComponent(q)}`;
    if (dialects) url += `&dialects=${encodeURIComponent(dialects)}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();
    return NextResponse.json({ results: data.results ?? [] });
  } catch {
    return NextResponse.json({ results: [], offline: true });
  }
}
```

### Step 2 — `HoverableWord` component

Copy `components/browser/HoverableWord.tsx` as-is. The only external dependency is the `/api/dict` route above.

### Step 3 — Wrap lyrics text

Wherever you render romanized text, replace the plain string render with:

```tsx
{text.split('\n').map((line, li) => (
  <div key={li}>
    {line.split(' ').filter(Boolean).map((word, wi) => (
      <HoverableWord key={wi} word={word} language={songLanguage} />
    ))}
  </div>
))}
```

`language` must be one of the keys in `LANG_TO_DIALECTS` (e.g. `'Amis'`, `'Paiwan'`) so the dialect filter narrows results to the song's language. Pass `null` or omit it to search all dialects.

### Step 4 — Environment variable

Add to `.env.local` (optional — defaults to live Citadel):
```
PORTAL_URL=https://ycm-citadel.vercel.app
```

---

## Behavior summary

| Behavior | Value |
|---|---|
| Hover dwell before fetch | 300 ms |
| Hide delay after mouse leave | 220 ms |
| Tooltip stays open if cursor moves onto it | Yes (`keepOpen` clears the hide timer) |
| Re-fetches on repeated hover | No (cached in `fetched` ref per component instance) |
| Upstream ISR cache | 300 s (`next: { revalidate: 300 }`) |
| Minimum query length | 2 characters |
| Max results shown | 6 |
| Tooltip width | 240 px (`w-60`) |
| Mobile | Hover events don't fire on touch — feature silently absent on mobile |
| Offline / Citadel down | Returns `{ results: [] }` — tooltip shows "Not found", no error thrown |
