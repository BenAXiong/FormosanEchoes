import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerClient } from '@/lib/supabase';

export const maxDuration = 120; // Gemini + search grounding can take 30–60 s

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY ?? '';
const YOUTUBE_API_KEY  = process.env.YOUTUBE_API_KEY ?? ''; // optional — enables description + comments

// ── YouTube data helpers ──────────────────────────────────────────────────────

async function fetchYouTubeContext(videoId: string): Promise<string> {
  if (!YOUTUBE_API_KEY) return '';
  const lines: string[] = [];

  try {
    // Video details (description)
    const vidUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const vidRes = await fetch(vidUrl);
    if (vidRes.ok) {
      const vid = await vidRes.json();
      const snippet = vid.items?.[0]?.snippet;
      if (snippet?.description) {
        lines.push(`--- YouTube Description ---`);
        lines.push(snippet.description.slice(0, 2000)); // cap at 2k chars
      }
    }
  } catch { /* non-fatal */ }

  try {
    // Top comments (sorted by relevance — often contain lyrics/credits)
    const cUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=15&key=${YOUTUBE_API_KEY}`;
    const cRes = await fetch(cUrl);
    if (cRes.ok) {
      const cData = await cRes.json();
      const comments: string[] = (cData.items ?? []).map((item: Record<string, unknown>) => {
        const s = (item.snippet as Record<string, unknown>)?.topLevelComment as Record<string, unknown>;
        const text = (s?.snippet as Record<string, unknown>)?.textDisplay as string ?? '';
        const likes = (s?.snippet as Record<string, unknown>)?.likeCount as number ?? 0;
        return likes > 0 ? `[${likes}♥] ${text}` : text;
      }).filter(Boolean);

      if (comments.length > 0) {
        lines.push(`--- Top YouTube Comments ---`);
        lines.push(comments.join('\n\n'));
      }
    }
  } catch { /* non-fatal — comments may be disabled */ }

  return lines.join('\n\n');
}

// ── Artist context from DB ────────────────────────────────────────────────────

function splitCreditTokens(raw: string): string[] {
  const parts = raw.split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i).map(p => p.trim()).filter(Boolean);
  const tokens: string[] = [];
  for (const part of parts.length > 1 ? parts : [raw]) {
    tokens.push(part);
    const m = part.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (m) { tokens.push(m[1].trim(), m[2].trim()); }
  }
  return [...new Set(tokens)];
}

async function fetchArtistContext(artistCredit: string): Promise<string> {
  if (!artistCredit) return '';
  const tokens = splitCreditTokens(artistCredit);
  if (!tokens.length) return '';

  try {
    const supabase = createServerClient();
    const seen = new Set<string>();
    const blocks: string[] = [];

    for (const token of tokens) {
      const { data: nameRows } = await supabase
        .from('artist_names')
        .select('artist_id')
        .ilike('name', token)
        .limit(1);

      const artistId = nameRows?.[0]?.artist_id;
      if (!artistId || seen.has(artistId)) continue;
      seen.add(artistId);

      const { data: artist } = await supabase
        .from('artists')
        .select('*, artist_names(name, script)')
        .eq('id', artistId)
        .single();

      if (!artist) continue;

      type NameRow = { name: string; script: string };
      const names = (artist.artist_names ?? []) as NameRow[];
      const names_zh = names.filter(n => n.script === 'zh').map(n => n.name);
      const names_en = names.filter(n => n.script === 'en').map(n => n.name);
      const names_ab = names.filter(n => n.script === 'ab').map(n => n.name);

      const lines: string[] = [];
      const displayName = names_en[0] ?? names_ab[0] ?? names_zh[0] ?? token;
      lines.push(`Artist: ${displayName}`);
      if (names_zh.length) lines.push(`Chinese name(s): ${names_zh.join(', ')}`);
      if (names_en.length > 1) lines.push(`Also known as: ${names_en.slice(1).join(', ')}`);
      if (names_ab.length) lines.push(`Indigenous script name(s): ${names_ab.join(', ')}`);
      if (artist.ethnic_groups?.length) lines.push(`Ethnic group: ${(artist.ethnic_groups as string[]).join(', ')}`);
      if (artist.language) lines.push(`Language: ${artist.language}`);
      if (artist.active_years) lines.push(`Active years: ${artist.active_years}`);
      if (artist.bio_en) lines.push(`Bio: ${(artist.bio_en as string).slice(0, 600)}`);
      else if (artist.bio_zh) lines.push(`Bio (ZH): ${(artist.bio_zh as string).slice(0, 400)}`);

      blocks.push(lines.join('\n'));
    }

    if (!blocks.length) return '';
    return `--- Known Artist Context (from our database) ---\n${blocks.join('\n\n')}`;
  } catch {
    return ''; // non-fatal
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert researcher specialising in Indigenous Taiwanese (Formosan) music.
Taiwan officially recognises 16 Indigenous peoples: Amis (Pangcah), Atayal, Paiwan, Bunun, Puyuma,
Rukai, Tsou, Saisiyat, Tao (Yami), Thao, Kavalan, Truku, Sakizaya, Seediq, Hla'alua, Kanakanavu.

Your goal is to find accurate metadata and full lyrics for a given song.
Use Google Search to find official lyrics (e.g., from MoJim, album booklets, or artist websites).
Check the provided YouTube context (description/comments) carefully as they often contain lyrics.
If a "Known Artist Context" block is provided, use it to sharpen your search — the ethnic group,
language, and biography narrow down which community and era the song belongs to.

Rules for your JSON output:
- Use null (not empty string) when a field is unknown.
- "title_original": The song title in the original indigenous language — Latin-script or indigenous script only. Do NOT put Chinese characters here. If you only know the Chinese title, leave "title_original" null and use "title_chinese" instead. Use sentence case: capitalize only the first letter (e.g. "Senasenai", not "SENASENAI" or "senasenai").
- "title_chinese": The officially published Chinese name — from an album cover, artist page, or music database (KKBOX, Spotify, 五大唱片), OR clearly present as the song title in the YouTube video title. Do NOT translate the indigenous title yourself. Do NOT use genre/style descriptors from YouTube titles (e.g. "古調", "族語歌曲", "傳統歌謠" are labels, not titles). If the source is the YouTube title, say so in "notes". Leave null if no official Chinese title is known.
- "artist": The primary artist's single canonical name only — do NOT combine multiple name forms (e.g., use "Biung Wang" OR "王宏恩", not "王宏恩 (Biung Wang)"). Prefer the indigenous Latin-script name where one exists (e.g., "Samingad", "Sangpuy", "Biung").
- "language_claimed": MUST be one of the 16 groups above. If it is a mix, pick the primary one.
- "ethnic_group_claimed": Same 16-group list — the ethnic group associated with the song.
- "genre": One of: Traditional, Traditional Choral, Modern Folk, Contemporary Folk, Contemporary Indigenous Folk-Pop, Indigenous Gospel / Folk.
- "recording_type": One of: Studio, Live, Home Recording, Field Recording.
- "lyrics_original": Provide the FULL lyrics in the indigenous language (Latin script if applicable).
- "lyrics_translation_zh": Provide a Traditional Chinese translation.
- "lyrics_translation_en": Provide an English translation.
- "notes": Mention where you found the lyrics or any ambiguities about the dialect.
- "tags": Comma-separated content tags. Do NOT repeat information already in other fields — e.g., do not add the language name, ethnic group, or genre as a tag since those have dedicated fields. Focus on content themes or context not expressed elsewhere (e.g., "ceremonial", "lullaby", "love-song", "choral", "children", "harvest", "wedding").
- "youtube_url": The most official YouTube video URL for this song (if you can find one), else null.

Example Output:
{
  "title_original": "Senasenai",
  "title_chinese": "大家來唱歌",
  "artist": "Samingad",
  "language_claimed": "Puyuma",
  "ethnic_group_claimed": "Puyuma",
  "genre": "Contemporary Indigenous Folk-Pop",
  "recording_type": "Studio",
  "year": "1999",
  "lyrics_original": "senasenai kema lra... (full lyrics)",
  "lyrics_translation_zh": "大家一起來唱歌... (full translation)",
  "lyrics_translation_en": "Everyone come and sing... (full translation)",
  "lyrics_source": "Voice of Puyuma Album Booklet",
  "tags": "love-song, traditional",
  "notes": "Classic Puyuma song by Samingad."
}

CRITICAL: Your entire response must be a single valid JSON object. Do not include any text, explanation, markdown code fences, or commentary before or after the JSON.`;

// ── JSON extraction (robust against preamble/epilogue text) ──────────────────

function extractJsonObject(raw: string): Record<string, unknown> | null {
  // Strip all markdown code fences globally, then trim
  const s = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  // Strategy 1: parse the whole stripped string
  try { return JSON.parse(s) as Record<string, unknown>; } catch {}
  // Strategy 2: first { to last } (handles leading/trailing prose)
  const first = s.indexOf('{');
  const last  = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)) as Record<string, unknown>; } catch {}
    // Strategy 3: step forward through each { to skip preamble containing stray braces
    for (let i = first + 1; i < last; i = s.indexOf('{', i + 1)) {
      if (i === -1) break;
      try { return JSON.parse(s.slice(i, last + 1)) as Record<string, unknown>; } catch {}
    }
  }
  return null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: { title?: string; channel?: string; youtube_url?: string; videoId?: string; titleMode?: boolean; artist_credit?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title = '', channel = '', youtube_url = '', videoId = '', titleMode = false, artist_credit = '' } = body;
  if (!title && !youtube_url) {
    return NextResponse.json({ error: 'Provide at least title or youtube_url' }, { status: 400 });
  }

  // Fetch YouTube context and artist context in parallel (both non-fatal)
  const [ytContext, artistContext] = await Promise.all([
    videoId ? fetchYouTubeContext(videoId) : Promise.resolve(''),
    artist_credit ? fetchArtistContext(artist_credit) : Promise.resolve(''),
  ]);

  const userMessage = titleMode
    ? [
        `Song title to look up: "${title}"`,
        `\nSearch for this song online. Find the most official YouTube video for it if one exists.`,
        `Return the JSON metadata object, and include "youtube_url" with the best YouTube URL you find (or null if none exists).`,
      ].join('\n')
    : [
        `Video title: "${title}"`,
        channel ? `Channel: "${channel}"` : '',
        `YouTube URL: ${youtube_url}`,
        artistContext ? `\n${artistContext}` : '',
        ytContext     ? `\n${ytContext}`     : '',
        `\nSearch for this song and return the JSON metadata object.`,
      ].filter(Boolean).join('\n');

  try {
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel(
      { model: 'gemini-2.5-pro', tools: [{ googleSearch: {} } as any] },  // eslint-disable-line @typescript-eslint/no-explicit-any
      { timeout: 110_000 },
    );

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);

    const raw = result.response.text().trim();

    const enriched = extractJsonObject(raw);
    if (!enriched) {
      return NextResponse.json({ error: 'Gemini returned non-JSON response', raw }, { status: 502 });
    }
    const aiLabel = `[AI research — ${new Date().toISOString().slice(0, 10)}]`;

    // Label AI-generated fields
    if (enriched.notes) {
      enriched.notes = `${enriched.notes}\n\n${aiLabel}`;
    } else {
      enriched.notes = aiLabel;
    }
    if (!enriched.lyrics_source) {
      enriched.lyrics_source = `AI research — ${new Date().toISOString().slice(0, 10)}`;
    }

    // Include grounding sources if available (for UI provenance display)
    const groundingMeta = result.response.candidates?.[0]?.groundingMetadata;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sources: { url: string; title: string | null }[] = (groundingMeta?.groundingChunks ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .flatMap((c: any) => c.web?.uri ? [{ url: c.web.uri as string, title: (c.web.title as string) ?? null }] : []);

    // Artist DB match — try to find an existing artist record for auto-linking
    let artist_match: { id: string; name_display: string } | null = null;
    const resolvedArtist = (enriched.artist as string | null) ?? artist_credit;
    if (resolvedArtist) {
      try {
        const supabase = createServerClient();
        const tokens = splitCreditTokens(resolvedArtist);
        for (const token of tokens) {
          const { data } = await supabase
            .from('artist_names')
            .select('artist_id, artists(id, name_display)')
            .ilike('name', token)
            .limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const artist = (data?.[0]?.artists as any);
          if (artist) { artist_match = { id: artist.id, name_display: artist.name_display }; break; }
        }
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ enriched, sources, artist_match });
  } catch (err: unknown) {
    console.error('[enrich-song]', err);
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { status: number; statusText: string };
      if (e.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited — wait ~30 seconds and try again.' },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: `Gemini API error: ${e.status} ${e.statusText}` }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gemini API error: ${msg}` }, { status: 500 });
  }
}
