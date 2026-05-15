import CurationView from './CurationView';
import { redirect } from 'next/navigation';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (key !== '654321') {
    redirect('/');
  }

  return <CurationView />;
}
