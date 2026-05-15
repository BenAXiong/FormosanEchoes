import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('songs')
    .select(`
      id,
      language,
      ethnic_group,
      year,
      genre,
      title_zh,
      verification_status,
      song_artists (artist_id),
      lyrics (show_publicly, lyrics_original, lyrics_zh, lyrics_en)
    `);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const songs = data ?? [];
  const total = songs.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gaps = {
    no_language:     songs.filter((s: any) => !s.language).length,
    no_ethnic_group: songs.filter((s: any) => !s.ethnic_group).length,
    no_year:         songs.filter((s: any) => !s.year).length,
    no_genre:        songs.filter((s: any) => !s.genre).length,
    no_title_zh:     songs.filter((s: any) => !s.title_zh).length,
    no_artist_link:  songs.filter((s: any) => !(s.song_artists as any[]).length).length,
    no_lyrics:       songs.filter((s: any) => !(s.lyrics as any[]).length).length,
  };

  const verification: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of songs as any[]) {
    const v: string = s.verification_status ?? 'unknown';
    verification[v] = (verification[v] ?? 0) + 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lyricRows = (songs as any[]).flatMap(s => s.lyrics ?? []);
  const lyrics = {
    total:            lyricRows.length,
    not_public:       lyricRows.filter((l: any) => !l.show_publicly).length,
    missing_original: lyricRows.filter((l: any) => !l.lyrics_original).length,
    missing_zh:       lyricRows.filter((l: any) => !l.lyrics_zh).length,
    missing_en:       lyricRows.filter((l: any) => !l.lyrics_en).length,
  };

  return NextResponse.json({ total, gaps, verification, lyrics });
}
