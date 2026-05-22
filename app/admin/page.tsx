import { redirect } from 'next/navigation';
import { getSongs } from '@/lib/db';
import { createAuthServerClient } from '@/lib/supabase';
import CurationView from './CurationView';

export const revalidate = 30;

export default async function AdminPage() {
  // Middleware already blocks unauthenticated requests; this is defence-in-depth.
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const songs = await getSongs();
  return <CurationView songs={songs} />;
}
