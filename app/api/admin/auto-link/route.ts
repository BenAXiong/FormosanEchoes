/**
 * POST /api/admin/auto-link
 * Scans all songs with unresolved artist_credit strings and links them to
 * any matching artist already in the DB. No AI — pure name matching against
 * the artist_names table. Safe to call repeatedly (upsert, ignoreDuplicates).
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function splitArtistString(raw: string): string[] {
  const parts = raw
    .split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

export async function POST() {
  const supabase = createServerClient();

  // All songs that have an artist string
  const { data: songs, error: songsError } = await supabase
    .from('songs')
    .select('id, artist_credit, song_artists(artist_id)')
    .not('artist_credit', 'is', null);

  if (songsError) return NextResponse.json({ error: songsError.message }, { status: 500 });

  // Full artist_names lookup table
  const { data: artistNames, error: namesError } = await supabase
    .from('artist_names')
    .select('artist_id, name');

  if (namesError) return NextResponse.json({ error: namesError.message }, { status: 500 });

  const nameMap = new Map<string, string>();
  for (const row of artistNames ?? []) {
    nameMap.set(row.name.toLowerCase().trim(), row.artist_id);
  }

  const toLink: { song_id: string; artist_id: string }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const song of songs ?? [] as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingIds = new Set<string>((song.song_artists as any[]).map((sa: any) => sa.artist_id));
    const parts = splitArtistString(song.artist_credit);

    for (const part of parts) {
      const artistId = nameMap.get(part.toLowerCase().trim());
      if (artistId && !existingIds.has(artistId)) {
        toLink.push({ song_id: song.id, artist_id: artistId });
        existingIds.add(artistId);
      }
    }
  }

  if (toLink.length === 0) {
    return NextResponse.json({ linked: 0 });
  }

  const { error: linkError } = await supabase
    .from('song_artists')
    .upsert(toLink, { onConflict: 'song_id,artist_id', ignoreDuplicates: true });

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  return NextResponse.json({ linked: toLink.length });
}
