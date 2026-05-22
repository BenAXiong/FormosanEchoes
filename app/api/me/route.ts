import { createAuthServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({ user: user ?? null });
}
