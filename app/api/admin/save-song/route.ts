import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function getYouTubeId(url: string): string | null {
  const w = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (w) return w[1];
  const s = url.match(/youtu\.be\/([^?]+)/);
  if (s) return s[1];
  return null;
}

function splitArtistString(raw: string): string[] {
  const parts = raw
    .split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

function toLabel(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(request: Request) {
  let song: Record<string, any>;
  try {
    song = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!song.youtube_url) {
    return NextResponse.json({ error: 'Song must have youtube_url' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Duplicate check
  const { data: existing } = await supabase
    .from('songs')
    .select('id')
    .eq('yt_url', song.youtube_url)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Duplicate YouTube URL' }, { status: 409 });
  }

  // Resolve artist IDs by querying artist_names
  const artistIds: string[] = [];
  if (song.artist) {
    for (const part of splitArtistString(String(song.artist))) {
      const { data } = await supabase
        .from('artist_names')
        .select('artist_id')
        .ilike('name', part.trim())
        .limit(1)
        .maybeSingle();
      if (data?.artist_id && !artistIds.includes(data.artist_id)) {
        artistIds.push(data.artist_id);
      }
    }
  }

  // Merge notes fields
  const notes = [song.verification_notes, song.source_snippets, song.notes]
    .filter(Boolean).join('\n\n') || null;

  // Insert song
  const { data: savedSong, error: songError } = await supabase
    .from('songs')
    .insert({
      title_original:      song.title_original      ?? null,
      title_zh:            song.title_chinese        ?? null,
      artist_credit:       song.artist               ?? null,
      yt_url:              song.youtube_url,
      yt_video_id:         getYouTubeId(String(song.youtube_url)),
      url:                 song.url                  ?? null,
      album:               song.album_or_source      ?? null,
      year:                song.year != null ? String(song.year) : null,
      language:            song.language_claimed     ?? null,
      ethnic_group:        song.ethnic_group_claimed ?? null,
      region:              song.region               ?? null,
      location:            song.location_claimed     ?? null,
      genre:               song.genre                ?? null,
      notes,
      verification_status: song.verification_status  ?? 'candidate',
    })
    .select('id')
    .single();

  if (songError) {
    return NextResponse.json({ error: songError.message }, { status: 500 });
  }

  const songId = savedSong.id;

  // song_artists
  if (artistIds.length > 0) {
    await supabase.from('song_artists').insert(
      artistIds.map(artist_id => ({ song_id: songId, artist_id }))
    );
  }

  // tags — upsert each value, then link
  const tags: string[] = Array.isArray(song.tags) ? song.tags : [];
  if (tags.length > 0) {
    for (const value of tags) {
      await supabase.from('tags').upsert({ value, label: toLabel(value) }, { onConflict: 'value' });
    }
    const { data: tagRows } = await supabase.from('tags').select('id').in('value', tags);
    if (tagRows?.length) {
      await supabase.from('song_tags').insert(
        tagRows.map((t: { id: string }) => ({ song_id: songId, tag_id: t.id }))
      );
    }
  }

  // lyrics (nested object from AddSongPanel)
  const lyrics = song.lyrics as Record<string, unknown> | null;
  if (lyrics && (lyrics.lyrics_original || lyrics.lyrics_translation_zh || lyrics.lyrics_translation_en)) {
    await supabase.from('lyrics').insert({
      song_id:         songId,
      lyrics_original: lyrics.lyrics_original        ?? null,
      lyrics_zh:       lyrics.lyrics_translation_zh  ?? null,
      lyrics_en:       lyrics.lyrics_translation_en  ?? null,
      source:          lyrics.lyrics_source          ?? null,
      show_publicly:   false,
    });
  }

  return NextResponse.json({
    saved: { id: songId },
    artist_linked: artistIds.length > 0,
    unlinked_artist: artistIds.length === 0 && song.artist ? song.artist : null,
  });
}
