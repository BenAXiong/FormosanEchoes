import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(request: Request) {
  const { artist_id } = await request.json().catch(() => ({}));
  if (!artist_id) return NextResponse.json({ error: 'Missing artist_id' }, { status: 400 });

  const supabase = createServerClient();

  // Clean up related rows (in case schema lacks CASCADE)
  await supabase.from('song_artists').delete().eq('artist_id', artist_id);
  await supabase.from('artist_members').delete().or(`group_artist_id.eq.${artist_id},member_artist_id.eq.${artist_id}`);
  await supabase.from('artist_names').delete().eq('artist_id', artist_id);

  const { error } = await supabase.from('artists').delete().eq('id', artist_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
