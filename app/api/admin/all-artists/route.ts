import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const [{ data, error }, { data: songLinks }, { data: memberships }] = await Promise.all([
    supabase.from('artists').select('*, artist_names(*)').order('name_display'),
    supabase.from('song_artists').select('artist_id'),
    supabase.from('artist_members').select('group_artist_id, member_artist_id'),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build song count per artist
  const songCountMap = new Map<string, number>();
  for (const row of songLinks ?? []) {
    songCountMap.set(row.artist_id, (songCountMap.get(row.artist_id) ?? 0) + 1);
  }

  // Build member↔group maps
  const memberGroupMap = new Map<string, string[]>();
  const groupMemberMap = new Map<string, string[]>();
  for (const row of memberships ?? []) {
    const mg = memberGroupMap.get(row.member_artist_id) ?? [];
    memberGroupMap.set(row.member_artist_id, [...mg, row.group_artist_id]);
    const gm = groupMemberMap.get(row.group_artist_id) ?? [];
    groupMemberMap.set(row.group_artist_id, [...gm, row.member_artist_id]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artists = (data ?? []).map((row: any) => {
    const names = (row.artist_names ?? []) as { name: string; script: string }[];
    const song_count = songCountMap.get(row.id) ?? 0;
    const ethnic_groups: string[] = row.ethnic_groups ?? [];

    const researched_fields: string[] = row.researched_fields ?? [];

    const rawMissing: string[] = [];
    if (!row.bio_en && !row.bio_zh) rawMissing.push('no_bio');
    if (ethnic_groups.length === 0)  rawMissing.push('no_ethnic_group');
    if (!row.language)               rawMissing.push('no_language');
    if (!row.active_years)           rawMissing.push('no_active_years');
    if (!row.youtube_channel && !row.wikipedia_url) rawMissing.push('no_links');
    if (song_count === 0)            rawMissing.push('no_linked_songs');
    const missing = rawMissing.filter(m => !researched_fields.includes(m));

    return {
      id:              row.id,
      name_display:    row.name_display,
      names_zh:        names.filter(n => n.script === 'zh').map(n => n.name),
      names_en:        names.filter(n => n.script === 'en').map(n => n.name),
      names_ab:        names.filter(n => n.script === 'ab').map(n => n.name),
      zh_surname:      row.zh_surname      ?? null,
      ethnic_groups,
      language:        row.language        ?? null,
      is_group:        row.is_group        ?? false,
      active_years:    row.active_years    ?? null,
      bio_zh:          row.bio_zh          ?? null,
      bio_en:          row.bio_en          ?? null,
      bio_ycm:         row.bio_ycm         ?? null,
      youtube_channel: row.youtube_channel ?? null,
      wikipedia_url:   row.wikipedia_url   ?? null,
      website_url:     row.website_url     ?? null,
      sources:         row.sources         ?? [],
      notes:           row.notes           ?? null,
      photo_url:        row.photo_url        ?? null,
      researched_fields,
      group_ids:  memberGroupMap.get(row.id) ?? [],
      member_ids: groupMemberMap.get(row.id) ?? [],
      song_count,
      missing,
    };
  });

  return NextResponse.json(artists);
}
