import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, DynamicRetrievalMode } from '@google/generative-ai';

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

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert researcher specialising in Indigenous Taiwanese (Formosan) music.
Taiwan officially recognises 16 Indigenous peoples: Amis (Pangcah), Atayal, Paiwan, Bunun, Puyuma,
Rukai, Tsou, Saisiyat, Tao (Yami), Thao, Kavalan, Truku, Sakizaya, Seediq, Hla'alua, Kanakanavu.

You have access to Google Search — use it to look up this song, its artist, lyrics, and any relevant info.
Search in both English and Traditional Chinese (繁體中文). Check YouTube comments if they contain lyrics or credits.

Rules for your JSON output:
- Use null (not empty string) when a field is genuinely unknown — NEVER guess or hallucinate.
- For "artist", prefer the indigenous name form (e.g. "Samingad" over "紀曉君"; "ABAO" over "阿爆").
- "language_claimed" must be one of the 16 official group names above, or null.
- "ethnic_group_claimed" may differ from "language_claimed" (e.g. a Puyuma artist singing in Amis).
- For lyrics: include them if you find them. Mark null if you cannot find them with confidence.
- Do not invent lyrics. If partial, include what you found and note it in "notes".

Return ONLY a valid JSON object — no markdown, no explanation, no fences:
{
  "title_original": "title in the original indigenous language or most authentic form",
  "title_romanized": "romanized/latin-script title if original is CJK, else null",
  "title_chinese": "Chinese title if it exists, else null",
  "artist": "primary artist — prefer indigenous name form",
  "language_claimed": "one of the 16 official group names, or null",
  "ethnic_group_claimed": "one of the 16 official group names, or null",
  "genre": "one of: Traditional | Traditional Choral | Modern Folk | Contemporary Folk | Contemporary Indigenous Folk-Pop | Indigenous Gospel / Folk — or null",
  "year": "4-digit year string, or null",
  "album_or_source": "album name or compilation title, or null",
  "lyrics_original": "full lyrics in the indigenous language, or null",
  "lyrics_romanized": "romanized lyrics if original is CJK, else null",
  "lyrics_translation_zh": "Traditional Chinese translation, or null",
  "lyrics_translation_en": "English translation, or null",
  "lyrics_source": "URL or description of where lyrics were found, or null",
  "notes": "important context, disambiguation, or source caveats — or null"
}`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: { title?: string; channel?: string; youtube_url?: string; videoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title = '', channel = '', youtube_url = '', videoId = '' } = body;
  if (!title && !youtube_url) {
    return NextResponse.json({ error: 'Provide at least title or youtube_url' }, { status: 400 });
  }

  // Optionally fetch YouTube description + comments
  const ytContext = videoId ? await fetchYouTubeContext(videoId) : '';

  const userMessage = [
    `Video title: "${title}"`,
    `Channel: "${channel}"`,
    `YouTube URL: ${youtube_url}`,
    ytContext ? `\n${ytContext}` : '',
    `\nSearch for this song and return the JSON metadata object.`,
  ].filter(Boolean).join('\n');

  try {
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel(
      {
        model: 'gemini-2.5-flash',
        tools: [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: DynamicRetrievalMode.MODE_DYNAMIC,
              dynamicThreshold: 0.3, // use search whenever even slightly useful
            },
          },
        }],
      },
      { apiVersion: 'v1' }
    );

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);

    const raw = result.response.text().trim();

    // Strip markdown fences if Gemini wraps the JSON
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

    let enriched: Record<string, unknown>;
    try {
      enriched = JSON.parse(jsonStr);
    } catch {
      // Try to extract the first {...} block if Gemini added commentary
      const match = jsonStr.match(/\{[\s\S]+\}/);
      if (match) {
        try {
          enriched = JSON.parse(match[0]);
        } catch {
          return NextResponse.json({ error: 'Gemini returned non-JSON response', raw }, { status: 502 });
        }
      } else {
        return NextResponse.json({ error: 'Gemini returned non-JSON response', raw }, { status: 502 });
      }
    }

    // Include grounding sources if available (for UI provenance display)
    const groundingMeta = result.response.candidates?.[0]?.groundingMetadata;
    const sources = (groundingMeta?.groundingChunks ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => c.web?.uri)
      .filter(Boolean);

    return NextResponse.json({ enriched, sources });
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
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
  }
}
