import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('songs')
    .select('id, title_original, title_zh, artist_credit, language, ethnic_group, genre, recording_type, year, album, description, notes, yt_url, yt_video_id, lyrics(song_id, lyrics_original, lyrics_zh, lyrics_en, show_publicly)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const songs = (data ?? []).flatMap((s: any) => {
    const missing: string[] = [];
    if (!s.language) missing.push('language');
    if (!s.ethnic_group) missing.push('ethnic_group');
    const hasLyricsContent = !!(s.lyrics?.lyrics_original || s.lyrics?.lyrics_zh || s.lyrics?.lyrics_en);
    if (!hasLyricsContent) missing.push('lyrics');
    else if (!s.lyrics?.show_publicly) missing.push('lyrics_unapproved');
    if (missing.length === 0) return [];

    return [{
      id:             s.id            as string,
      title:          (s.title_original || s.title_zh || '(untitled)') as string,
      title_original: (s.title_original ?? null) as string | null,
      title_zh:       (s.title_zh      ?? null) as string | null,
      artist_credit:  (s.artist_credit  || '')  as string,
      yt_url:         (s.yt_url         || '')  as string,
      yt_video_id:    (s.yt_video_id    ?? null) as string | null,
      language:       (s.language       ?? null) as string | null,
      ethnic_group:   (s.ethnic_group   ?? null) as string | null,
      genre:          (s.genre          ?? null) as string | null,
      recording_type: (s.recording_type ?? null) as string | null,
      year:           (s.year           ?? null) as string | null,
      album:          (s.album          ?? null) as string | null,
      description:    (s.description    ?? null) as string | null,
      notes:          (s.notes          ?? null) as string | null,
      lyrics_original:    (s.lyrics?.lyrics_original ?? null) as string | null,
      lyrics_zh:          (s.lyrics?.lyrics_zh       ?? null) as string | null,
      lyrics_en:          (s.lyrics?.lyrics_en       ?? null) as string | null,
      lyrics_show_publicly: (s.lyrics?.show_publicly  ?? false) as boolean,
      missing,
    }];
  });

  return NextResponse.json(songs);
}
