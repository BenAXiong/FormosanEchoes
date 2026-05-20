import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/admin/rescan-artist-songs
 * Re-runs the ilike alias scan for a single artist and upserts any newly
 * matched song_artists rows. Safe to call repeatedly (ignoreDuplicates).
 */
export async function POST(request: Request) {
  const { artist_id } = await request.json() as { artist_id?: string };
  if (!artist_id) return NextResponse.json({ error: 'artist_id required' }, { status: 400 });

  const supabase = createServerClient();

  const { data: names } = await supabase
    .from('artist_names')
    .select('name')
    .eq('artist_id', artist_id);

  const aliases = (names ?? []).map(n => n.name.trim()).filter(n => n.length >= 2);
  if (!aliases.length) return NextResponse.json({ linked: 0 });

  const ilikeFilter = aliases.map(a => `artist_credit.ilike.%${a}%`).join(',');

  const { data: songs } = await supabase
    .from('songs')
    .select('id')
    .or(ilikeFilter);

  if (!songs?.length) return NextResponse.json({ linked: 0 });

  const toLink = songs.map(s => ({ song_id: s.id, artist_id }));
  const { error } = await supabase
    .from('song_artists')
    .upsert(toLink, { onConflict: 'song_id,artist_id', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ linked: toLink.length });
}
