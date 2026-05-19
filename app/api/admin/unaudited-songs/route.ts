import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === 'true';

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('songs')
    .select('id, yt_title, title_original, title_zh, title_en, artist_credit, url, language, ethnic_group, region, location, genre, recording_type, year, album, description, notes, verification_status, yt_url, yt_video_id, song_tags(tags(value)), lyrics(song_id, lyrics_original, lyrics_zh, lyrics_en, source, show_publicly), song_artists(artists(name_display, artist_names(name, script)))')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapSong = (s: any) => {
    // Resolve linked artist names: "RomanizedName - 中文名" per artist
    type ArtistNameRow = { name: string; script: string };
    type ArtistRow = { name_display: string; artist_names: ArtistNameRow[] };
    const linkedArtists: ArtistRow[] = (s.song_artists ?? [])
      .map((sa: { artists: ArtistRow | null }) => sa.artists)
      .filter(Boolean);
    const artist_display = linkedArtists.length > 0
      ? linkedArtists.map(a => {
          const names = a.artist_names ?? [];
          const en = names.find(n => n.script === 'en' || n.script === 'ab')?.name;
          const zh = names.find(n => n.script === 'zh')?.name;
          if (en && zh) return `${en} - ${zh}`;
          return en ?? zh ?? a.name_display;
        }).join(' × ')
      : null;
    const missing: string[] = [];
    if (!s.language) missing.push('language');
    if (!s.ethnic_group) missing.push('ethnic_group');
    if (!s.artist_credit) missing.push('no_artist');
    if (!s.yt_url && !s.url) missing.push('no_url');
    const hasLyricsContent = !!(s.lyrics?.lyrics_original || s.lyrics?.lyrics_zh || s.lyrics?.lyrics_en);
    const lyricsSearched = (s.lyrics?.source ?? '').startsWith('[not found');
    if (!hasLyricsContent && !lyricsSearched) missing.push('lyrics');
    else if (hasLyricsContent && !s.lyrics?.show_publicly) missing.push('lyrics_unapproved');

    const tags = (s.song_tags ?? [])
      .map((st: Record<string, unknown>) => (st.tags as Record<string, unknown>)?.value as string)
      .filter(Boolean);

    return {
      id:                   s.id              as string,
      title:                (s.title_original || s.title_zh || s.yt_title || '(untitled)') as string,
      yt_title:             (s.yt_title       ?? null) as string | null,
      title_original:       (s.title_original ?? null) as string | null,
      title_zh:             (s.title_zh       ?? null) as string | null,
      title_en:             (s.title_en       ?? null) as string | null,
      artist_credit:        (s.artist_credit  || '')   as string,
      artist_display:       artist_display,
      url:                  (s.url            ?? null) as string | null,
      yt_url:               (s.yt_url         || '')   as string,
      yt_video_id:          (s.yt_video_id    ?? null) as string | null,
      language:             (s.language       ?? null) as string | null,
      ethnic_group:         (s.ethnic_group   ?? null) as string | null,
      region:               (s.region         ?? null) as string | null,
      location:             (s.location       ?? null) as string | null,
      genre:                (s.genre          ?? null) as string | null,
      recording_type:       (s.recording_type ?? null) as string | null,
      year:                 (s.year           ?? null) as string | null,
      album:                (s.album          ?? null) as string | null,
      description:          (s.description    ?? null) as string | null,
      notes:                (s.notes          ?? null) as string | null,
      verification_status:  (s.verification_status ?? null) as string | null,
      tags,
      lyrics_original:      (s.lyrics?.lyrics_original ?? null) as string | null,
      lyrics_zh:            (s.lyrics?.lyrics_zh       ?? null) as string | null,
      lyrics_en:            (s.lyrics?.lyrics_en       ?? null) as string | null,
      lyrics_show_publicly: (s.lyrics?.show_publicly   ?? false) as boolean,
      missing,
    };
  };

  const songs = all
    ? (data ?? []).map(mapSong)
    : (data ?? []).map(mapSong).filter(s => s.missing.length > 0);

  return NextResponse.json(songs);
}
