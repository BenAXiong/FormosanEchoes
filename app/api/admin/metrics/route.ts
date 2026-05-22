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
    lyrics (show_publicly, lyrics_original, lyrics_zh, lyrics_en, source)
  `);

  if (language)            q = q.eq('language',            language);
  if (verification_status) q = q.eq('verification_status', verification_status);
  if (artist)              q = q.eq('artist_credit',       artist);

  const [songResult, artistResult, songArtistResult] = await Promise.all([
    q,
    supabase.from('artists').select(
      'id, bio_zh, bio_en, ethnic_groups, language, active_years, youtube_channel, wikipedia_url, photo_url, researched_fields'
    ),
    supabase.from('song_artists').select('artist_id'),
  ]);

  if (songResult.error) return NextResponse.json({ error: songResult.error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let songs = (songResult.data ?? []) as any[];

  if (missing_field) {
    songs = songs.filter(s => {
      const hasLyricsContent = toArray(s.lyrics).some(
        (l: { lyrics_original?: string; lyrics_zh?: string; lyrics_en?: string }) =>
          l.lyrics_original || l.lyrics_zh || l.lyrics_en
      );
      switch (missing_field) {
        case 'language':     return !s.language;
        case 'ethnic_group': return !s.ethnic_group;
        case 'no_artist':    return !s.artist_credit;
        case 'no_url':       return !s.yt_url && !s.url;
        case 'lyrics': {
          const searched = toArray(s.lyrics).some((l: { source?: string }) => l.source?.startsWith('[not found'));
          return !hasLyricsContent && !searched;
        }
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

  // Song-level lyrics breakdown (mutually exclusive buckets)
  const lyricsPublic = songs.filter((s: any) => {
    const lr = toArray(s.lyrics)[0];
    return lr?.show_publicly === true;
  }).length;

  const lyricsPrivateContent = songs.filter((s: any) => {
    const lr = toArray(s.lyrics)[0];
    if (!lr || lr.show_publicly) return false;
    return !!(lr.lyrics_original || lr.lyrics_zh || lr.lyrics_en);
  }).length;

  const lyricsSearchedNA = songs.filter((s: any) => {
    const lr = toArray(s.lyrics)[0];
    if (!lr || lr.show_publicly) return false;
    if (lr.lyrics_original || lr.lyrics_zh || lr.lyrics_en) return false;
    return lr.source?.startsWith('[not found');
  }).length;

  // Quality bars for songs that do have a lyrics row
  const lyricRows = songs.flatMap((s: any) => toArray(s.lyrics));
  const lyricsRowTotal = lyricRows.length;

  const lyricsNA = {
    not_public:      lyricRows.filter((l: any) => !l.show_publicly && l.source?.startsWith('[not found')).length,
    missing_original: lyricRows.filter((l: any) => !l.lyrics_original && l.source?.startsWith('[not found')).length,
    missing_zh:      lyricRows.filter((l: any) => !l.lyrics_zh && l.source?.startsWith('[not found')).length,
    missing_en:      lyricRows.filter((l: any) => !l.lyrics_en && l.source?.startsWith('[not found')).length,
  };

  const lyrics = {
    public:          lyricsPublic,
    private_content: lyricsPrivateContent,
    searched_na:     lyricsSearchedNA,
    total:           lyricsRowTotal,
    missing_original: lyricRows.filter((l: any) => !l.lyrics_original).length,
    missing_zh:       lyricRows.filter((l: any) => !l.lyrics_zh).length,
    missing_en:       lyricRows.filter((l: any) => !l.lyrics_en).length,
    na: lyricsNA,
  };

  // Artist metrics — always global, not filtered by song parameters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artistRows = (artistResult.data ?? []) as any[];
  const linkedArtistIds = new Set((songArtistResult.data ?? []).map((r: any) => r.artist_id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rf = (a: any): string[] => a.researched_fields ?? [];
  const artistsNoSongs = artistRows.filter((a: any) => !linkedArtistIds.has(a.id));

  const artists = {
    total:    artistRows.length,
    no_songs: artistsNoSongs.length,
    gaps: {
      no_bio:          artistRows.filter((a: any) => !a.bio_en && !a.bio_zh).length,
      no_ethnic_group: artistRows.filter((a: any) => !(a.ethnic_groups?.length)).length,
      no_language:     artistRows.filter((a: any) => !a.language).length,
      no_active_years: artistRows.filter((a: any) => !a.active_years).length,
      no_links:        artistRows.filter((a: any) => !a.youtube_channel && !a.wikipedia_url).length,
      no_photo:        artistRows.filter((a: any) => !a.photo_url).length,
    },
    na: {
      no_bio:          artistRows.filter((a: any) => !a.bio_en && !a.bio_zh && rf(a).includes('no_bio')).length,
      no_ethnic_group: artistRows.filter((a: any) => !(a.ethnic_groups?.length) && rf(a).includes('no_ethnic_group')).length,
      no_language:     artistRows.filter((a: any) => !a.language && rf(a).includes('no_language')).length,
      no_active_years: artistRows.filter((a: any) => !a.active_years && rf(a).includes('no_active_years')).length,
      no_links:        artistRows.filter((a: any) => !a.youtube_channel && !a.wikipedia_url && rf(a).includes('no_links')).length,
      no_songs:        artistsNoSongs.filter((a: any) => rf(a).includes('no_linked_songs')).length,
    },
  };

  return NextResponse.json({
    songs: { total, gaps, verification },
    lyrics,
    artists,
  });
}
