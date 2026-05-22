import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playlist_id, song_id, position } = await request.json() as {
    playlist_id: string; song_id: string; position: number;
  };
  await supabase.from('user_playlist_songs').upsert({ playlist_id, song_id, position });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playlist_id, song_id } = await request.json() as {
    playlist_id: string; song_id: string;
  };
  await supabase.from('user_playlist_songs').delete().match({ playlist_id, song_id });

  return NextResponse.json({ ok: true });
}
