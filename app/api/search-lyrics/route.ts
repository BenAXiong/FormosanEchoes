import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function extractSnippet(text: string | null, q: string): string | null {
  if (!text) return null;
  const ql = q.toLowerCase();
  const line = text.split('\n').find(l => l.toLowerCase().includes(ql));
  return line?.trim() || null;
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  // Escape SQL wildcard chars so a literal "%" doesn't match everything
  const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('lyrics')
    .select(`
      song_id,
      lyrics_original,
      lyrics_zh,
      lyrics_en,
      songs ( id, title_original, title_zh, artist_credit, language, yt_url )
    `)
    .or(`lyrics_original.ilike.%${safe}%,lyrics_zh.ilike.%${safe}%,lyrics_en.ilike.%${safe}%`)
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data ?? []).map((row: any) => {
    const song = row.songs;
    const snippet =
      extractSnippet(row.lyrics_original, q) ??
      extractSnippet(row.lyrics_zh, q) ??
      extractSnippet(row.lyrics_en, q) ?? '';

    return {
      song_id:      row.song_id as string,
      title:        (song?.title_original || song?.title_zh || '(Untitled)') as string,
      artist_credit: (song?.artist_credit ?? null) as string | null,
      language:     (song?.language ?? null) as string | null,
      yt_url:       (song?.yt_url ?? null) as string | null,
      snippet,
    };
  });

  return NextResponse.json(results);
}
