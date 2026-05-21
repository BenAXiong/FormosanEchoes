import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { video_ids?: string[] };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const video_ids = (body.video_ids ?? []).filter(Boolean);
  if (!video_ids.length) return NextResponse.json({ duplicates: [] });

  const supabase = createServerClient();
  const { data } = await supabase
    .from('songs')
    .select('yt_video_id')
    .in('yt_video_id', video_ids);

  const duplicates = (data ?? [])
    .map((r: { yt_video_id: string }) => r.yt_video_id)
    .filter(Boolean);

  return NextResponse.json({ duplicates });
}
