import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { group_artist_id: string; member_artist_ids: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { group_artist_id, member_artist_ids } = body;
  if (!group_artist_id) return NextResponse.json({ error: 'Missing group_artist_id' }, { status: 400 });

  const supabase = createServerClient();

  // Replace all member rows for this group
  await supabase.from('artist_members').delete().eq('group_artist_id', group_artist_id);

  if (member_artist_ids.length > 0) {
    const rows = member_artist_ids.map(member_artist_id => ({ group_artist_id, member_artist_id }));
    const { error } = await supabase.from('artist_members').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member_count: member_artist_ids.length });
}
