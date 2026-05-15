import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('songs')
    .select('id, title_original, artist_credit, song_artists(artist_id)')
    .not('artist_credit', 'is', null);

  if (error) {
    return NextResponse.json([]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unlinked = (data ?? [])
    .filter((s: any) => !(s.song_artists as any[]).length && s.artist_credit)
    .map((s: any) => ({
      song_artist_string: s.artist_credit as string,
      suggested_action: `"${s.title_original ?? 'Unknown'}" — add artist to DB or link manually`,
    }));

  return NextResponse.json(unlinked);
}
