# Analytics — Formosan Echoes

## Provider: Umami

**Cloud:** app.umami.is (free tier: 100K events/mo)  
**Self-host path:** Railway template → Umami app + Postgres. Point `DATABASE_URL` at the existing Supabase Postgres connection string if preferred. MIT licensed — no license friction.  
**Script:** `https://cloud.umami.is/script.js` loaded via `app/layout.tsx` with `strategy="afterInteractive"`.  
**Website ID env var:** `NEXT_PUBLIC_UMAMI_WEBSITE_ID`

All call sites use the abstraction layer at `lib/analytics.ts`. Swapping providers = one file change.

---

## Provider Comparison

| | GA4 | PostHog | Umami | Plausible | Vercel |
|---|---|---|---|---|---|
| Free events/mo | Unlimited | 1M | 100K | Trial only | 50K |
| Cookies | Yes (consent req.) | Optional (cookie-free mode) | No | No | Hash-based |
| GDPR consent banner | Required (EU) | Not needed (cookie-free) | Not needed | Not needed | Not needed |
| Custom events | Unlimited (25 params) | Unlimited | Yes + JSON props | Paid plan only | 2 free / 8 Pro |
| Session replay | No | 5K/mo free | No | No | No |
| Script size | ~30 KB | ~50 KB | < 2 KB | 1.4 KB | Lightweight |
| Self-host | Not possible | Docker (heavy: 4 vCPU / 8 GB) | Node.js + Postgres (light) | Elixir + ClickHouse | Not possible |
| License | Proprietary | MIT | MIT | AGPLv3 | Proprietary |

**Why not GA4:** Sends data to Google — ethically misaligned for an indigenous cultural project. Requires GDPR consent banner. 30 KB script.  
**Why not PostHog (cloud):** Strong second choice if session replay is needed. 50× heavier script. Self-host is impractical without dedicated infra.  
**Why not Plausible:** No viable free tier; custom event props locked to paid plan.  
**Why not Vercel:** Only 2 custom event types free — insufficient for this app's 14 event types.

### Self-hosting Umami
- **Railway:** One-click template, 500 hrs/month free, Postgres included. Zero ops.
- **Supabase Postgres:** Set Umami `DATABASE_URL` to the project's Postgres connection string. No extra DB cost; host the Umami Next.js app on Railway or Fly.io.
- Trigger: when cloud 100K/mo limit is consistently hit. Same code instrumentation, just update the script URL + `NEXT_PUBLIC_UMAMI_WEBSITE_ID`.

---

## Instrumentation

### Abstraction layer — `lib/analytics.ts`

```typescript
export function track(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;  // SSR-safe
  window.umami?.track(event, data);           // no-ops if blocked by ad blocker
}
```

To switch to PostHog: replace the body with `posthog.capture(event, data)`. No other files change.

---

## Events Catalog

| Event | Properties | Fired in |
|---|---|---|
| `song-play` | `song_id`, `title`, `artist`, `language` | `PlayerContext.playTrack` |
| `song-pause` | `song_id` | `PlayerContext.pauseTrack` / `togglePlay` |
| `song-resume` | `song_id` | `PlayerContext.resumeTrack` / `togglePlay` |
| `song-skip` | `direction: 'next'\|'prev'`, `from_song_id` | `PlayerContext.nextTrack` / `prevTrack` |
| `song-listen` | `threshold: '30s'\|'2min'`, `song_id`, `title`, `language` | `PlayerContext` — cumulative play time, resets on song change and pause |
| `song-search` | `query`, `mode: 'songs'\|'lyrics'`, `result_count` | `BrowserPage` (400ms debounce on `query`) |
| `filter-language` | `language` | `BrowserPage` filter change effect |
| `filter-genre` | `genre` | `BrowserPage` filter change effect |
| `filter-lyrics` | `enabled: boolean` | `BrowserPage` filter change effect |
| `tab-switch` | `tab: 'songs'\|'artists'` | `BrowserPage` tab change effect |
| `artist-open` | `artist_id`, `name` | `BrowserPage` — fires when `selectedArtist` changes to non-null |
| `lyrics-mode` | `mode: 'original'\|'zh'\|'en'\|'seq'\|'side'`, `song_id` | `NowPlaying` — tab click or swipe gesture; skips initial mount |
| `favorite-toggle` | `song_id`, `action: 'add'\|'remove'` | `PlayerContext.toggleFavorite` |
| `playlist-create` | — | `PlayerContext.createPlaylist` |
| `playlist-add-song` | — | `PlayerContext.addSongToPlaylist` |
| `share` | `type: 'song'\|'artist'\|'playlist'`, `platform: 'native'\|'modal'` | `BrowserPage.openShare` |
| `share-platform` | `platform: 'instagram'\|'facebook'\|'whatsapp'\|'x'\|'reddit'\|'copy'` | `ShareModal` per-button; UTM source also appended to the shared URL |
| `deep-link` | `type: 'song'\|'artist'\|'playlist'` | `BrowserPage` mount effect |
| `language-toggle` | `to: 'en'\|'zh'` | `LangProvider.setLang` / `toggleLang` |
| `karaoke-toggle` | `enabled: boolean` | `PlayerContext.toggleKaraokeMode` |
| `sign-in` | — | `PlayerContext` `onAuthStateChange` — fires on `SIGNED_IN` event only (not on page load) |

### UTM attribution
`ShareModal` appends `&utm_source=<platform>` to every shared URL (facebook, whatsapp, x, reddit, instagram, link). Umami captures UTM parameters automatically from the URL, so shared-link visits appear in the Sources report without any extra instrumentation.

---

## Adding New Events

```typescript
import { track } from '@/lib/analytics';

track('event-name', { property: value });
```

The `track()` call is synchronous and non-blocking. It no-ops silently if:
- Running server-side (SSR guard)
- Umami script is blocked by an ad blocker
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is not set
