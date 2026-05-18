import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language            = searchParams.get('language')            ?? '';
  const verification_status = searchParams.get('verification_status') ?? '';

  const supabase = createServerClient();

  let q = supabase.from('songs').select('artist_credit').not('artist_credit', 'is', null);
  if (language)            q = q.eq('language',            language);
  if (verification_status) q = q.eq('verification_status', verification_status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const artists = [...new Set(
    (data ?? []).map(s => s.artist_credit as string).filter(Boolean)
  )].sort();

  return NextResponse.json(artists);
}
