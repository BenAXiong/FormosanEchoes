import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

type Body = { song_id: string; artist_id: string };

function computeArtistDisplay(names: { name: string; script: string }[], name_display: string): string {
  const indigenous = names.find(n => n.script === 'ab')?.name ?? names.find(n => n.script === 'en')?.name;
  const zh = names.find(n => n.script === 'zh')?.name;
  if (indigenous && zh) return `${indigenous} - ${zh}`;
  return indigenous ?? zh ?? name_display;
}

// POST — create link
export async function POST(request: Request) {
  let body: Partial<Body>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { song_id, artist_id } = body;
  if (!song_id || !artist_id) return NextResponse.json({ error: 'Missing song_id or artist_id' }, { status: 400 });

  const supabase = createServerClient();

  // Upsert — safe to call even if already linked
  const { error: linkErr } = await supabase
    .from('song_artists')
    .upsert({ song_id, artist_id }, { onConflict: 'song_id,artist_id', ignoreDuplicates: true });
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  // Return updated linked artists for the song
  const { data: rows, error: fetchErr } = await supabase
    .from('song_artists')
    .select('artist_id, artists(name_display, artist_names(name, script))')
    .eq('song_id', song_id);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  type NameRow = { name: string; script: string };
  type ArtistRow = { name_display: string; artist_names: NameRow[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linked = (rows ?? []).map((r: any) => {
    const artist = r.artists as ArtistRow | null;
    if (!artist) return null;
    return { id: r.artist_id as string, name_display: computeArtistDisplay(artist.artist_names ?? [], artist.name_display) };
  }).filter(Boolean) as { id: string; name_display: string }[];

  return NextResponse.json({ linked });
}

// DELETE — remove link
export async function DELETE(request: Request) {
  let body: Partial<Body>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { song_id, artist_id } = body;
  if (!song_id || !artist_id) return NextResponse.json({ error: 'Missing song_id or artist_id' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase
    .from('song_artists')
    .delete()
    .eq('song_id', song_id)
    .eq('artist_id', artist_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return remaining linked artists
  const { data: rows } = await supabase
    .from('song_artists')
    .select('artist_id, artists(name_display, artist_names(name, script))')
    .eq('song_id', song_id);

  type NameRow = { name: string; script: string };
  type ArtistRow = { name_display: string; artist_names: NameRow[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linked = (rows ?? []).map((r: any) => {
    const artist = r.artists as ArtistRow | null;
    if (!artist) return null;
    return { id: r.artist_id as string, name_display: computeArtistDisplay(artist.artist_names ?? [], artist.name_display) };
  }).filter(Boolean) as { id: string; name_display: string }[];

  return NextResponse.json({ linked });
}
