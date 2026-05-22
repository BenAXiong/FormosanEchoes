import { getSongs, getArtists } from '@/lib/db';
import BrowserPage from '@/components/browser/BrowserPage';

export const revalidate = 60;

export default async function Page({
  searchParams,
}: {
  readonly searchParams: Promise<{ song?: string; artist?: string; playlist?: string }>;
}) {
  const params = await searchParams;
  const [songs, artists] = await Promise.all([getSongs(), getArtists()]);
  const publicSongs = songs.filter(s => s.language_claimed || (s.artist_ids?.length ?? 0) > 0);
  return (
    <BrowserPage
      songs={publicSongs}
      artists={artists}
      initialSongId={params.song}
      initialArtistId={params.artist}
      initialPlaylistId={params.playlist}
    />
  );
}
