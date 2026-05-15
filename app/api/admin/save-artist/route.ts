import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function inferScript(name: string): string {
  return /[一-鿿㐀-䶿]/.test(name) ? 'zh' : 'ab';
}

function splitArtistString(raw: string): string[] {
  const parts = raw
    .split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: Request) {
  let artist: Record<string, any>;
  try {
    artist = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!artist.name_display) {
    return NextResponse.json({ error: 'Artist must have name_display' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: saved, error } = await supabase
    .from('artists')
    .insert({
      name_display:    artist.name_display,
      ethnic_group:    artist.ethnic_group    ?? null,
      language:        artist.language        ?? null,
      is_group:        artist.is_group        ?? false,
      active_years:    artist.active_years    ?? null,
      bio_zh:          artist.bio_zh          ?? null,
      bio_en:          artist.bio_en          ?? null,
      zh_surname:      artist.zh_surname      ?? null,
      youtube_channel: artist.youtube_channel ?? null,
      wikipedia_url:   artist.wikipedia_url   ?? null,
      notes:           artist.notes           ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert all name variants for search/linking
  const names: { artist_id: string; name: string; script: string }[] = [];
  for (const n of (artist.names_zh as string[]) ?? []) {
    names.push({ artist_id: saved.id, name: n, script: 'zh' });
  }
  for (const n of (artist.names_rom as string[]) ?? []) {
    names.push({ artist_id: saved.id, name: n, script: 'ab' });
  }
  for (const n of (artist.names_indigenous as string[]) ?? []) {
    names.push({ artist_id: saved.id, name: n, script: 'ab' });
  }
  names.push({ artist_id: saved.id, name: artist.name_display, script: inferScript(artist.name_display) });
  await supabase.from('artist_names').insert(names);

  // Re-link existing songs whose artist_credit matches any of this artist's aliases
  const allAliases = names.map(n => n.name.toLowerCase().trim());

  const { data: songRows } = await supabase
    .from('songs')
    .select('id, artist_credit')
    .not('artist_credit', 'is', null);

  const toLink: { song_id: string; artist_id: string }[] = [];
  for (const song of songRows ?? []) {
    const parts = splitArtistString(song.artist_credit).map((p: string) => p.toLowerCase().trim());
    if (parts.some(p => allAliases.includes(p))) {
      toLink.push({ song_id: song.id, artist_id: saved.id });
    }
  }

  let songs_linked = 0;
  if (toLink.length > 0) {
    const { error: linkError } = await supabase
      .from('song_artists')
      .upsert(toLink, { onConflict: 'song_id,artist_id', ignoreDuplicates: true });
    if (!linkError) songs_linked = toLink.length;
  }

  return NextResponse.json({ saved: { id: saved.id, name_display: artist.name_display }, songs_linked });
}
