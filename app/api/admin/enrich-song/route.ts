import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

const SYSTEM_PROMPT = `You are an expert researcher on Indigenous Taiwanese (Formosan) music.
You will be given a YouTube video title, channel name, and video URL.
Your task is to research this song and return structured metadata.

Return ONLY a valid JSON object with this exact shape (no markdown, no explanation):
{
  "title_original": "title in the original indigenous language or most authentic form",
  "title_romanized": "romanized title if the original is in Chinese or CJK characters, else null",
  "title_chinese": "Chinese title if it exists, else null",
  "artist": "primary artist name — prefer the indigenous name form",
  "language_claimed": "one of: Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, Tsou, Saisiyat, Tao (Yami), Thao, Kavalan, Truku, Sakizaya, Seediq, Hla'alua, Kanakanavu — or null if unknown",
  "ethnic_group_claimed": "same options as language_claimed — may differ if the song is performed by non-native artist",
  "genre": "one of: Traditional, Traditional Choral, Modern Folk, Contemporary Folk, Contemporary Indigenous Folk-Pop, Indigenous Gospel / Folk — or null",
  "year": "4-digit year string if known, else null",
  "album_or_source": "album name or source if known, else null",
  "lyrics_original": "full lyrics in the indigenous language if you can find them, else null",
  "lyrics_romanized": "romanized lyrics if original is CJK, else null",
  "lyrics_translation_zh": "Traditional Chinese translation of the lyrics if available, else null",
  "lyrics_translation_en": "English translation of the lyrics if available, else null",
  "lyrics_source": "where you found the lyrics (URL or description), else null",
  "notes": "any important context, disambiguation, or caveats — else null"
}`;

export async function POST(request: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let body: { title?: string; channel?: string; youtube_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title = '', channel = '', youtube_url = '' } = body;
  if (!title && !youtube_url) {
    return NextResponse.json({ error: 'Provide at least title or youtube_url' }, { status: 400 });
  }

  const userMessage = `Video title: "${title}"
Channel: "${channel}"
YouTube URL: ${youtube_url}

Research this song and return the JSON metadata object.`;

  try {
    const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      return NextResponse.json(
        { error: 'Gemini returned non-JSON response', raw },
        { status: 502 }
      );
    }

    return NextResponse.json({ enriched });
  } catch (err) {
    console.error('[enrich-song]', err);
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
  }
}
