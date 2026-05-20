import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { keep_id?: string; merge_id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { keep_id, merge_id } = body;
  if (!keep_id || !merge_id)  return NextResponse.json({ error: 'Missing keep_id or merge_id' }, { status: 400 });
  if (keep_id === merge_id)   return NextResponse.json({ error: 'keep_id and merge_id must differ' }, { status: 400 });

  const supabase = createServerClient();

  // 1. Copy names from merge → keep, skipping exact duplicates
  const [{ data: mergeNames }, { data: keepNames }] = await Promise.all([
    supabase.from('artist_names').select('name, script').eq('artist_id', merge_id),
    supabase.from('artist_names').select('name, script').eq('artist_id', keep_id),
  ]);
  const keepNameSet = new Set((keepNames ?? []).map(n => `${n.script}:${n.name.toLowerCase()}`));
  const toInsert = (mergeNames ?? [])
    .filter(n => !keepNameSet.has(`${n.script}:${n.name.toLowerCase()}`))
    .map(n => ({ artist_id: keep_id, name: n.name, script: n.script }));
  if (toInsert.length > 0) {
    await supabase.from('artist_names').insert(toInsert);
  }

  // 2. Re-link songs: delete merge's links, upsert for keep (ignoreDuplicates handles overlap)
  const { data: mergeSongs } = await supabase
    .from('song_artists').select('song_id').eq('artist_id', merge_id);
  if ((mergeSongs ?? []).length > 0) {
    await supabase.from('song_artists').delete().eq('artist_id', merge_id);
    await supabase.from('song_artists').upsert(
      mergeSongs!.map(r => ({ song_id: r.song_id, artist_id: keep_id })),
      { onConflict: 'song_id,artist_id', ignoreDuplicates: true },
    );
  }

  // 3. Re-link artist_members: delete merge's rows, upsert for keep, drop any self-refs
  const [{ data: groupRows }, { data: memberRows }] = await Promise.all([
    supabase.from('artist_members').select('member_artist_id').eq('group_artist_id', merge_id),
    supabase.from('artist_members').select('group_artist_id').eq('member_artist_id', merge_id),
  ]);
  await Promise.all([
    supabase.from('artist_members').delete().eq('group_artist_id', merge_id),
    supabase.from('artist_members').delete().eq('member_artist_id', merge_id),
  ]);
  const groupInserts = (groupRows ?? [])
    .map(r => ({ group_artist_id: keep_id, member_artist_id: r.member_artist_id }))
    .filter(r => r.member_artist_id !== keep_id);
  const memberInserts = (memberRows ?? [])
    .map(r => ({ group_artist_id: r.group_artist_id, member_artist_id: keep_id }))
    .filter(r => r.group_artist_id !== keep_id);
  if (groupInserts.length > 0) {
    await supabase.from('artist_members').upsert(groupInserts, { onConflict: 'group_artist_id,member_artist_id', ignoreDuplicates: true });
  }
  if (memberInserts.length > 0) {
    await supabase.from('artist_members').upsert(memberInserts, { onConflict: 'group_artist_id,member_artist_id', ignoreDuplicates: true });
  }

  // 4. Delete merged artist (names first to avoid FK issues)
  await supabase.from('artist_names').delete().eq('artist_id', merge_id);
  const { error } = await supabase.from('artists').delete().eq('id', merge_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, kept: keep_id, merged: merge_id });
}
