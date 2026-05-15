# Formosan Echoes

A curated browser and discovery platform for **Formosan-language (Indigenous Taiwanese) music**. Covers songs in Amis, Bunun, Paiwan, Atayal, Puyuma, Seediq, Rukai, Saisiyat, Tao, Thao, Kavalan, and other CIP languages.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Language | TypeScript (strict) |
| AI enrichment | Google Gemini 2.5 Flash |
| Audio/video | ReactPlayer |
| Data | JSON files (no database yet) |

## Running locally

```bash
npm install
npm run dev        # http://localhost:3002
```

**Required env vars** (`.env.local`):

```env
GEMINI_API_KEY=...        # Admin song enrichment via Gemini
YOUTUBE_API_KEY=...       # Optional — enables description/comment fetching during enrichment
PORTAL_URL=...            # Dictionary API (default: https://ycm-citadel.vercel.app)
```

## Routes

| Route | Description |
|---|---|
| `/` | Public demo — dark-themed song browser with persistent bottom player |
| `/admin?key=654321` | Admin curation panel (Browse / Add Song / Artist Audit) |

## Data files

| File | Contents |
|---|---|
| `data/songs.json` | ~400+ song records |
| `data/artists.json` | ~100 artist profiles |
| `data/artists_unlinked.json` | Artist strings awaiting manual linking |
| `data/controlled-vocab.json` | Allowed values: languages, tags, confidence, status |

## Key scripts

```bash
npm run link    # Re-run artist linker (idempotent — safe to run anytime)
npm run build   # Runs linker then Next.js build
```

**Artist linking** (`scripts/link-artists.js`) runs at build time. It resolves `song.artist` strings to `artist_ids` by matching against all name variants (Chinese, romanized, indigenous) in `artists.json`. Unmatched strings land in `artists_unlinked.json`. Re-run it after any edit to either data file.

## Lyrics rights

All lyrics display is gated by `lyrics.show_publicly === true`. If that flag is false or absent, lyrics are never rendered — even if the data exists in the JSON.
