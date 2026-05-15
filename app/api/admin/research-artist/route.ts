import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

const SYSTEM_PROMPT = `You are an expert researcher on Indigenous Taiwanese (Formosan) music.
You will be given an artist name string (possibly containing aliases or "feat." info).
Your task is to research this artist and return structured metadata for our database.

Focus on the PRIMARY artist if it's a "feat." string.

Return ONLY a valid JSON object (no markdown, no fences):
{
  "id": "leave as null, will be generated",
  "name_display": "primary name for display (prefer indigenous form if exists)",
  "names_zh": ["list", "of", "Chinese", "names"],
  "names_rom": ["list", "of", "Romanized", "names"],
  "names_indigenous": ["list", "of", "Indigenous", "script", "names", "if", "applicable"],
  "zh_surname": "Chinese surname if applicable, else null",
  "ethnic_group": "one of the 16 official groups (Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, Tsou, Saisiyat, Tao (Yami), Thao, Kavalan, Truku, Sakizaya, Seediq, Hla'alua, Kanakanavu) or null",
  "language": "primary language used by artist, or null",
  "is_group": true/false,
  "active_years": "string like '2010s–present' or null",
  "bio_zh": "short Chinese bio (1-2 sentences)",
  "bio_en": "short English bio (1-2 sentences)",
  "notable_works": ["list", "of", "2-3", "notable", "songs", "or", "albums"],
  "youtube_channel": "URL if found, else null",
  "wikipedia_url": "URL if found, else null",
  "sources": ["list", "of", "URLs", "used"],
  "notes": "any relevant context"
}`;

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: { artist_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { artist_name = '' } = body;
  if (!artist_name) {
    return NextResponse.json({ error: 'Missing artist_name' }, { status: 400 });
  }

  const userMessage = `Research this artist: "${artist_name}"\nProvide the full metadata object.`;

  try {
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel({
      model: 'gemini-3.1-pro',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);

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

    return NextResponse.json({ research });
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
