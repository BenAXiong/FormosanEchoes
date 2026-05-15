import { getSongs, getArtists } from '@/lib/db';
import DemoPage from '@/components/demo/DemoPage';

export const revalidate = 60;

export default async function Page() {
  const [songs, artists] = await Promise.all([getSongs(), getArtists()]);
  return <DemoPage songs={songs} artists={artists} />;
}
