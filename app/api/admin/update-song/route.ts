import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: { song_id: string; enriched?: Record<string, unknown>; fields?: Record<string, string | boolean | string[]> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { song_id, enriched, fields } = body;
  if (!song_id) return NextResponse.json({ error: 'song_id required' }, { status: 400 });

  const supabase = createServerClient();

  // ── Direct form save (from editor) ──────────────────────────────────────────
  if (fields) {
    const { lyrics_show_publicly, tags: rawTags, ...strFields } = fields as Record<string, string | boolean | string[]>;
    const f = strFields as Record<string, string>;
    const songUpdate: Record<string, string | null> = {
      yt_title:            f.yt_title            || null,
      title_original:      f.title_original      || null,
      title_zh:            f.title_zh            || null,
      title_en:            f.title_en            || null,
      artist_credit:       f.artist_credit       || null,
      url:                 f.url                 || null,
      language:            f.language            || null,
      ethnic_group:        f.ethnic_group        || null,
      region:              f.region              || null,
      location:            f.location            || null,
      genre:               f.genre               || null,
      recording_type:      f.recording_type      || null,
      year:                f.year                || null,
      album:               f.album               || null,
      description:         f.description         || null,
      notes:               f.notes               || null,
      verification_status: f.verification_status || null,
    };

    const { error: songErr } = await supabase.from('songs').update(songUpdate).eq('id', song_id);
    if (songErr) return NextResponse.json({ error: songErr.message }, { status: 500 });

    // Tags: replace all existing tags for this song
    const tagValues = typeof rawTags === 'string'
      ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
    if (tagValues.length > 0) {
      await supabase.from('song_tags').delete().eq('song_id', song_id);
      for (const value of tagValues) {
        await supabase.from('tags').upsert({ value, label: value.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) }, { onConflict: 'value' });
      }
      const { data: tagRows } = await supabase.from('tags').select('id').in('value', tagValues);
      if (tagRows?.length) {
        await supabase.from('song_tags').insert(tagRows.map((t: { id: string }) => ({ song_id, tag_id: t.id })));
      }
    }

    const hasLyrics = !!(f.lyrics_original || f.lyrics_zh || f.lyrics_en || f.lyrics_source);
    if (hasLyrics) {
      const { error: lyricsErr } = await supabase.from('lyrics').upsert({
        song_id,
        lyrics_original: f.lyrics_original || null,
        lyrics_zh:       f.lyrics_zh       || null,
        lyrics_en:       f.lyrics_en       || null,
        source:          f.lyrics_source   || null,
        show_publicly:   lyrics_show_publicly === true,
      }, { onConflict: 'song_id', ignoreDuplicates: false });
      if (lyricsErr) return NextResponse.json({ error: lyricsErr.message }, { status: 500 });
    }

    return NextResponse.json({ songs_updated: 1, lyrics_updated: hasLyrics ? 1 : 0 });
  }

  // ── Gemini enriched save (from batch enrich) ─────────────────────────────
  if (!enriched) return NextResponse.json({ error: 'enriched or fields required' }, { status: 400 });

  const songUpdate: Record<string, unknown> = {};
  if (enriched.language_claimed)     songUpdate.language       = enriched.language_claimed;
  if (enriched.ethnic_group_claimed) songUpdate.ethnic_group   = enriched.ethnic_group_claimed;
  if (enriched.genre)                songUpdate.genre          = enriched.genre;
  if (enriched.recording_type)       songUpdate.recording_type = enriched.recording_type;
  if (enriched.year)                 songUpdate.year           = enriched.year;
  if (enriched.album_or_source)      songUpdate.album          = enriched.album_or_source;
  if (enriched.title_original)       songUpdate.title_original = enriched.title_original;
  if (enriched.title_chinese)        songUpdate.title_zh       = enriched.title_chinese;
  if (enriched.notes)                songUpdate.notes          = enriched.notes;

  let songs_updated = 0;
  if (Object.keys(songUpdate).length > 0) {
    const { error } = await supabase.from('songs').update(songUpdate).eq('id', song_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    songs_updated = 1;
  }

  const hasActualLyrics = !!(enriched.lyrics_original || enriched.lyrics_translation_zh || enriched.lyrics_translation_en);
  const hasLyrics = hasActualLyrics || !!enriched.lyrics_source;
  let lyrics_updated = 0;
  if (hasLyrics) {
    const lyricsRow: Record<string, unknown> = { song_id, show_publicly: false };
    if (enriched.lyrics_original)       lyricsRow.lyrics_original = enriched.lyrics_original;
    if (enriched.lyrics_translation_zh) lyricsRow.lyrics_zh       = enriched.lyrics_translation_zh;
    if (enriched.lyrics_translation_en) lyricsRow.lyrics_en       = enriched.lyrics_translation_en;
    // Use proper not-found sentinel when AI searched but found no lyrics
    lyricsRow.source = hasActualLyrics
      ? (enriched.lyrics_source || null)
      : `[not found — AI ${new Date().toISOString().slice(0, 10)}]`;

    const { error } = await supabase.from('lyrics').upsert(lyricsRow, { onConflict: 'song_id', ignoreDuplicates: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lyrics_updated = 1;
  }

  return NextResponse.json({ songs_updated, lyrics_updated });
}
