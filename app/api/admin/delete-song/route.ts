import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(request: Request) {
  let body: { song_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { song_id } = body;
  if (!song_id) return NextResponse.json({ error: 'Missing song_id' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('songs').delete().eq('id', song_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
