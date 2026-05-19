import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function inferScript(name: string): string {
  return /[一-鿿㐀-䶿]/.test(name) ? 'zh' : 'en';
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
      ethnic_groups:   Array.isArray(artist.ethnic_groups) ? artist.ethnic_groups : (artist.ethnic_group ? [artist.ethnic_group] : []),
      language:        artist.language        ?? null,
      is_group:        artist.is_group        ?? false,
      active_years:    artist.active_years    ?? null,
      bio_zh:          artist.bio_zh          ?? null,
      bio_en:          artist.bio_en          ?? null,
      bio_ycm:         artist.bio_ycm         ?? null,
      zh_surname:      artist.zh_surname      ?? null,
      youtube_channel: artist.youtube_channel ?? null,
      wikipedia_url:   artist.wikipedia_url   ?? null,
      sources:         Array.isArray(artist.sources) ? artist.sources : [],
      photo_url:       artist.photo_url       ?? null,
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
  for (const n of (artist.names_en as string[]) ?? []) {
    names.push({ artist_id: saved.id, name: n, script: 'en' });
  }
  for (const n of (artist.names_ab as string[]) ?? []) {
    names.push({ artist_id: saved.id, name: n, script: 'ab' });
  }
  names.push({ artist_id: saved.id, name: artist.name_display, script: inferScript(artist.name_display) });
  await supabase.from('artist_names').insert(names);

  // Re-link existing songs whose artist_credit contains any of this artist's aliases
  // Use ilike substring matching so "Samingad 紀曉君" links to both "Samingad" and "紀曉君"
  const allAliases = names.map(n => n.name.trim()).filter(n => n.length >= 2);
  const ilikeFilter = allAliases.map(a => `artist_credit.ilike.%${a}%`).join(',');

  const { data: songRows } = await supabase
    .from('songs')
    .select('id')
    .or(ilikeFilter);

  const toLink = (songRows ?? []).map(s => ({ song_id: s.id, artist_id: saved.id }));

  let songs_linked = 0;
  if (toLink.length > 0) {
    const { error: linkError } = await supabase
      .from('song_artists')
      .upsert(toLink, { onConflict: 'song_id,artist_id', ignoreDuplicates: true });
    if (!linkError) songs_linked = toLink.length;
  }

  // ── Auto-create member records and link them (groups only) ──────────────────
  let members_linked = 0;
  if (artist.is_group && Array.isArray(artist.members) && artist.members.length > 0) {
    for (const member of artist.members as { name_display?: string }[]) {
      if (!member.name_display) continue;

      // Check if member already exists in artist_names
      const { data: existingName } = await supabase
        .from('artist_names')
        .select('artist_id')
        .ilike('name', member.name_display.trim())
        .limit(1)
        .maybeSingle();

      let memberId: string | null = existingName?.artist_id ?? null;

      if (!memberId) {
        // Create a stub artist record for this member
        const { data: newMember } = await supabase
          .from('artists')
          .insert({
            name_display:  member.name_display,
            ethnic_groups: Array.isArray(artist.ethnic_groups) ? artist.ethnic_groups : [],
            language:      artist.language ?? null,
            is_group:      false,
          })
          .select('id')
          .single();

        if (newMember) {
          memberId = newMember.id;
          await supabase.from('artist_names').insert({
            artist_id: memberId,
            name:      member.name_display,
            script:    inferScript(member.name_display),
          });
        }
      }

      if (memberId) {
        await supabase
          .from('artist_members')
          .upsert(
            { group_artist_id: saved.id, member_artist_id: memberId },
            { onConflict: 'group_artist_id,member_artist_id', ignoreDuplicates: true },
          );
        members_linked++;
      }
    }
  }

  return NextResponse.json({ saved: { id: saved.id, name_display: artist.name_display }, songs_linked, members_linked });
}
