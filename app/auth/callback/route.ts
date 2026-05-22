import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // 'next' controls where to land after auth; defaults to public browser
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createAuthServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
