import CurationView from './CurationView';
import { redirect } from 'next/navigation';

export default function AdminPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  if (searchParams.key !== '654321') {
    redirect('/');
  }

  return <CurationView />;
}
