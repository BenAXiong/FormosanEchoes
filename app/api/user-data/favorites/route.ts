import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { song_id, action } = await request.json() as { song_id: string; action: 'add' | 'remove' };

  if (action === 'add') {
    await supabase.from('user_favorites').upsert({ user_id: user.id, song_id });
  } else {
    await supabase.from('user_favorites').delete().match({ user_id: user.id, song_id });
  }

  return NextResponse.json({ ok: true });
}
