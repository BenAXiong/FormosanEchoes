import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArray(val: any): any[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language            = searchParams.get('language')            ?? '';
  const verification_status = searchParams.get('verification_status') ?? '';
  const artist              = searchParams.get('artist')              ?? '';
  const missing_field       = searchParams.get('missing_field')       ?? '';

  const supabase = createServerClient();

  let q = supabase.from('songs').select(`
    id,
    language,
    ethnic_group,
    year,
    genre,
    title_zh,
    verification_status,
    artist_credit,
    yt_url,
    url,
    song_artists (artist_id),
    lyrics (show_publicly, lyrics_original, lyrics_zh, lyrics_en)
  `);

  if (language)            q = q.eq('language',            language);
  if (verification_status) q = q.eq('verification_status', verification_status);
  if (artist)              q = q.eq('artist_credit',       artist);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let songs = (data ?? []) as any[];

  if (missing_field) {
    songs = songs.filter(s => {
      const hasLyricsContent = toArray(s.lyrics).some(
        (l: { lyrics_original?: string; lyrics_zh?: string; lyrics_en?: string }) =>
          l.lyrics_original || l.lyrics_zh || l.lyrics_en
      );
      switch (missing_field) {
        case 'language':         return !s.language;
        case 'ethnic_group':     return !s.ethnic_group;
        case 'no_artist':        return !s.artist_credit;
        case 'no_url':           return !s.yt_url && !s.url;
        case 'lyrics':           return !hasLyricsContent;
        case 'lyrics_unapproved':
          return hasLyricsContent && !toArray(s.lyrics).some(
            (l: { show_publicly?: boolean }) => l.show_publicly
          );
        default: return true;
      }
    });
  }

  const total = songs.length;

  const gaps = {
    no_language:     songs.filter((s: any) => !s.language).length,
    no_ethnic_group: songs.filter((s: any) => !s.ethnic_group).length,
    no_year:         songs.filter((s: any) => !s.year).length,
    no_genre:        songs.filter((s: any) => !s.genre).length,
    no_title_zh:     songs.filter((s: any) => !s.title_zh).length,
    no_artist_link:  songs.filter((s: any) => !toArray(s.song_artists).length).length,
    no_lyrics:       songs.filter((s: any) => !toArray(s.lyrics).length).length,
  };

  const verification: Record<string, number> = {};
  for (const s of songs) {
    const v: string = s.verification_status ?? 'unknown';
    verification[v] = (verification[v] ?? 0) + 1;
  }

  const lyricRows = songs.flatMap((s: any) => toArray(s.lyrics));
  const lyrics = {
    total:            lyricRows.length,
    not_public:       lyricRows.filter((l: any) => !l.show_publicly).length,
    missing_original: lyricRows.filter((l: any) => !l.lyrics_original).length,
    missing_zh:       lyricRows.filter((l: any) => !l.lyrics_zh).length,
    missing_en:       lyricRows.filter((l: any) => !l.lyrics_en).length,
  };

  return NextResponse.json({ total, gaps, verification, lyrics });
}
