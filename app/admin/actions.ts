'use server';

import { createAuthServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export async function signOut() {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
