import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/admin/similar-songs?title=...&artist=...
 * Returns up to 3 songs that share title/artist tokens with the query,
 * using Supabase's built-in FTS index on songs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title  = (searchParams.get('title')  ?? '').trim();
  const artist = (searchParams.get('artist') ?? '').trim();

  if (!title && !artist) return NextResponse.json([]);

  const supabase = createServerClient();

  // Build a tsquery from the most distinctive tokens (strip common words, punctuation)
  const raw = `${title} ${artist}`.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const tokens = raw.split(/\s+/).filter(t => t.length > 1);
  if (!tokens.length) return NextResponse.json([]);

  // Use OR-joined prefix queries so partial title matches still surface
  const tsquery = tokens.map(t => `${t}:*`).join(' | ');

  const { data, error } = await supabase
    .from('songs')
    .select('id, title_original, title_zh, yt_title, artist_credit, yt_url, yt_video_id')
    .textSearch('fts', tsquery, { config: 'simple' })
    .limit(3);

  if (error) {
    // FTS column name mismatch — fall back gracefully
    console.warn('[similar-songs] FTS error, falling back to ilike:', error.message);
    const { data: fallback } = await supabase
      .from('songs')
      .select('id, title_original, title_zh, yt_title, artist_credit, yt_url, yt_video_id')
      .or(`title_original.ilike.%${tokens[0]}%,artist_credit.ilike.%${tokens[0]}%`)
      .limit(3);
    return NextResponse.json(fallback ?? []);
  }

  return NextResponse.json(data ?? []);
}
