import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerClient } from '@/lib/supabase';

export const maxDuration = 120; // Gemini + search grounding can take 30–60 s

const GEMINI_API_KEY  = process.env.GEMINI_API_KEY ?? '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? '';

async function fetchYouTubeContext(videoId: string): Promise<string> {
  if (!YOUTUBE_API_KEY || !videoId) return '';
  const lines: string[] = [];
  try {
    const vidRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
    if (vidRes.ok) {
      const vid = await vidRes.json();
      const snippet = vid.items?.[0]?.snippet;
      if (snippet?.channelTitle) lines.push(`Channel: ${snippet.channelTitle}`);
      if (snippet?.description) {
        lines.push(`--- YouTube Description ---`);
        lines.push(snippet.description.slice(0, 2000));
      }
    }
  } catch { /* non-fatal */ }
  try {
    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=10&key=${YOUTUBE_API_KEY}`);
    if (cRes.ok) {
      const cData = await cRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comments: string[] = (cData.items ?? []).map((item: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = item.snippet?.topLevelComment?.snippet as any;
        return s?.textDisplay ?? '';
      }).filter(Boolean);
      if (comments.length) {
        lines.push(`--- Top Comments ---`);
        lines.push(comments.join('\n\n'));
      }
    }
  } catch { /* comments may be disabled */ }
  return lines.join('\n\n');
}

const SYSTEM_PROMPT = `You are an expert researcher on Indigenous Taiwanese (Formosan) music.
You will be given an artist name string (possibly containing aliases or "feat." info).
Your task is to research this artist and return structured metadata for our database.

Focus on the PRIMARY artist if it's a "feat." string.

Search strategy — follow in order:
1. Search for the EXACT name in quotes first (e.g. "原來是美族"). This is critical for Chinese names — do not split the name.
2. Check Wikipedia, government arts databases, and official music label pages first. Many artists are well-documented there.
3. If nothing official is found, expand to: Facebook pages, YouTube channel pages, Spotify/Apple Podcasts artist or show pages, StreetVoice profiles, TITV (原視) programme pages, concert or festival listings.
4. Do NOT search romanized/transliterated versions of Chinese names — they are rarely indexed and waste a search.
5. If YouTube context is provided below, read it carefully — the description and comments often name the artist directly.

Return ONLY a valid JSON object (no markdown, no fences):
{
  "name_display": "primary name for display (prefer indigenous/romanized form if exists)",
  "names_zh": ["Chinese name variants — first entry is the primary one"],
  "names_en": ["Latin/romanized name variants — first entry is the primary one, include all known spellings"],
  "names_ab": ["Indigenous-script names if applicable (Cjavi, Puyuma script, etc.), else []"],
  "zh_surname": "Chinese surname if applicable, else null",
  "ethnic_groups": ["array of matching groups from: Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, Tsou, Saisiyat, Tao (Yami), Thao, Kavalan, Truku, Sakizaya, Seediq, Hla'alua, Kanakanavu — most artists have just one, some span two"],
  "language": "primary language used by artist, or null",
  "is_group": true,
  "active_years": "string like '2010s–present' or null",
  "bio_zh": "short Chinese bio (1-2 sentences)",
  "bio_en": "short English bio (1-2 sentences)",
  "youtube_channel": "URL if found, else null",
  "wikipedia_url": "URL if found, else null",
  "photo_url": "A direct URL to a publicly accessible portrait photo (JPEG/PNG/WebP). Prefer: Wikipedia commons image files (e.g. https://upload.wikimedia.org/…), official press photos, or artist profile images. Must be a direct image URL, not a page URL. null if none found.",
  "sources": ["list", "of", "URLs", "used"],
  "notes": "any relevant context",
  "members": [{"name_display": "member name as commonly known"}]
}

If is_group is false, set members to [].
If is_group is true, list every known member with their most common name. These will be auto-created as individual artist records.`;

function splitArtistString(raw: string): string[] {
  const parts = raw
    .split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  // Also extract inner parenthetical names: "王宏恩 (Biung Wang)" → ["王宏恩 (Biung Wang)", "王宏恩", "Biung Wang"]
  const tokens: string[] = [];
  for (const part of parts.length > 1 ? parts : [raw]) {
    tokens.push(part);
    const m = part.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (m) { tokens.push(m[1].trim(), m[2].trim()); }
  }
  return [...new Set(tokens)];
}

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: { artist_name?: string; force?: boolean; yt_url?: string; song_title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artist_name = '', force = false, yt_url = '', song_title = '' } = body;
  if (!artist_name) {
    return NextResponse.json({ error: 'Missing artist_name' }, { status: 400 });
  }

  // ── DB pre-check: look for existing artists matching any part of the string ──
  const supabase = createServerClient();
  const parts = splitArtistString(artist_name);

  const existingMatches: { id: string; name_display: string; matched_on: string }[] = [];
  for (const part of parts) {
    const { data } = await supabase
      .from('artist_names')
      .select('artist_id, name, artists(id, name_display)')
      .ilike('name', `%${part.trim()}%`)
      .limit(3);

    for (const row of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const artist = (row.artists as any);
      if (artist && !existingMatches.find(m => m.id === artist.id)) {
        existingMatches.push({
          id: artist.id,
          name_display: artist.name_display,
          matched_on: row.name,
        });
      }
    }
  }

  // Return early if we found likely matches — unless caller explicitly wants Gemini anyway
  if (existingMatches.length > 0 && !force) {
    return NextResponse.json({ existing_matches: existingMatches });
  }

  // ── YouTube context (helps resolve garbage channel-name credits) ─────────────
  const videoId = yt_url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? '';
  const ytContext = await fetchYouTubeContext(videoId);

  // ── Gemini research ───────────────────────────────────────────────────────────
  const userMessage = [
    `Artist credit string: "${artist_name}"`,
    song_title ? `Song title: "${song_title}"` : '',
    yt_url     ? `YouTube URL: ${yt_url}` : '',
    ytContext  ? `\n${ytContext}\n\nThe artist credit above may be a YouTube channel name or otherwise inaccurate. Use the YouTube context above to identify the actual performing artist before searching further.` : '',
    `\nProvide the full metadata object.`,
  ].filter(Boolean).join('\n');

  async function callGemini(modelName: string) {
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel(
      { model: modelName, tools: [{ googleSearch: {} } as any] },  // eslint-disable-line @typescript-eslint/no-explicit-any
      { timeout: 110_000 },
    );
    return model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);
  }

  try {
    let result: Awaited<ReturnType<typeof callGemini>>;
    try {
      result = await callGemini('gemini-2.5-pro');
    } catch (proErr: unknown) {
      const status = (proErr as any)?.status;  // eslint-disable-line @typescript-eslint/no-explicit-any
      if (status === 503 || status === 429) {
        result = await callGemini('gemini-2.5-flash');
      } else {
        throw proErr;
      }
    }

    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

    let research: Record<string, unknown>;
    try {
      research = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]+\}/);
      if (match) {
        research = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: 'Gemini returned non-JSON response', raw }, { status: 502 });
      }
    }

    // Extract grounding sources for provenance display
    const groundingMeta = result.response.candidates?.[0]?.groundingMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sources: string[] = (groundingMeta?.groundingChunks ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => c.web?.uri as string)
      .filter(Boolean);

    return NextResponse.json({ research, sources });
  } catch (err: unknown) {
    console.error('[research-artist]', err);
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { status: number; statusText: string };
      if (e.status === 429) return NextResponse.json({ error: 'Rate limited — wait ~30s and try again.' }, { status: 429 });
      return NextResponse.json({ error: `Gemini error: ${e.status} ${e.statusText}` }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Gemini API error' }, { status: 500 });
  }
}
