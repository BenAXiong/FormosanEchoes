import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Uses the anon key — requires a public SELECT RLS policy on user_playlists:
//   CREATE POLICY "Public read by id" ON user_playlists FOR SELECT USING (true);
// The UUID itself acts as the access token.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Row = {
  id: string;
  name: string;
  user_playlist_songs: { song_id: string; position: number }[];
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('user_playlists')
    .select('id, name, user_playlist_songs(song_id, position)')
    .eq('id', id)
    .single<Row>();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const songIds = (data.user_playlist_songs ?? [])
    .sort((a, b) => a.position - b.position)
    .map(r => r.song_id);

  return NextResponse.json({ id: data.id, name: data.name, songIds });
}
