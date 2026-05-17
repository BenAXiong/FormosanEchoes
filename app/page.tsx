import { getSongs, getArtists } from '@/lib/db';
import BrowserPage from '@/components/browser/BrowserPage';

export const revalidate = 60;

export default async function Page() {
  const [songs, artists] = await Promise.all([getSongs(), getArtists()]);
  const publicSongs = songs.filter(s => s.language_claimed || (s.artist_ids?.length ?? 0) > 0);
  return <BrowserPage songs={publicSongs} artists={artists} />;
}
