import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json() as { name: string };
  const { data } = await supabase
    .from('user_playlists')
    .insert({ user_id: user.id, name })
    .select('id, name')
    .single();

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json() as { id: string };
  await supabase.from('user_playlists').delete().match({ id, user_id: user.id });

  return NextResponse.json({ ok: true });
}
