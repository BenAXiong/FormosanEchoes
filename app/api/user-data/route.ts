import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type PlaylistRow = {
  id: string;
  name: string;
  user_playlist_songs: { song_id: string; position: number }[];
};

export async function GET() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ favorites: [], playlists: [] });

  const [{ data: favRows }, { data: plRows }] = await Promise.all([
    supabase.from('user_favorites').select('song_id'),
    supabase.from('user_playlists')
      .select('id, name, user_playlist_songs(song_id, position)')
      .order('created_at'),
  ]);

  return NextResponse.json({
    favorites: (favRows as { song_id: string }[] | null)?.map(r => r.song_id) ?? [],
    playlists: ((plRows ?? []) as PlaylistRow[]).map(p => ({
      id: p.id,
      name: p.name,
      songIds: (p.user_playlist_songs ?? [])
        .sort((a, b) => a.position - b.position)
        .map(s => s.song_id),
    })),
  });
}
