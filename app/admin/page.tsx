import { redirect } from 'next/navigation';
import { getSongs } from '@/lib/db';
import CurationView from './CurationView';

export const revalidate = 30;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (key !== '654321') {
    redirect('/');
  }

  const songs = await getSongs();
  return <CurationView songs={songs} />;
}
