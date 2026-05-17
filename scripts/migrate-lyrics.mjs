/**
 * Migration: copy lyrics_romanized from songs.json → lyrics_original in Supabase.
 * Matches JSON songs to Supabase songs by YouTube URL.
 * Run once: node scripts/migrate-lyrics.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Load .env.local manually
const env = readFileSync('.env.local', 'utf8');
const vars = Object.fromEntries(
  env.split('\n').filter(l => l.includes('=')).map(l => {
    const idx = l.indexOf('=');
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(
  vars.NEXT_PUBLIC_SUPABASE_URL,
  vars.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, realtime: { transport: ws } }
);

// 1. Fetch all Supabase songs (id + yt_url)
const { data: dbSongs, error: songsErr } = await supabase
  .from('songs')
  .select('id, yt_url, title_original');
if (songsErr) { console.error('Failed to fetch songs:', songsErr.message); process.exit(1); }

// 2. Fetch existing lyrics rows to see what's already there
const { data: dbLyrics } = await supabase
  .from('lyrics')
  .select('song_id, lyrics_original, show_publicly');

const existingLyricsMap = new Map((dbLyrics ?? []).map(r => [r.song_id, r]));

console.log(`Supabase: ${dbSongs.length} songs, ${existingLyricsMap.size} lyrics rows`);

// Build yt_url → supabase id map
const ytToDbId = new Map();
for (const s of dbSongs) {
  if (s.yt_url) ytToDbId.set(s.yt_url.trim(), s.id);
}

// 3. Read JSON songs with lyrics
const jsonSongs = JSON.parse(readFileSync('data/songs.json', 'utf8'));
const toMigrate = jsonSongs.filter(s => s.lyrics?.lyrics_romanized && s.youtube_url);
console.log(`JSON: ${toMigrate.length} songs with lyrics_romanized + youtube_url\n`);

let ok = 0, noMatch = 0, fail = 0;
for (const song of toMigrate) {
  const dbId = ytToDbId.get(song.youtube_url?.trim());
  if (!dbId) {
    console.log(`  NO MATCH  ${song.title_original || song.title_romanized}  (${song.youtube_url})`);
    noMatch++;
    continue;
  }

  const existing = existingLyricsMap.get(dbId);
  const l = song.lyrics;
  const row = {
    song_id:         dbId,
    lyrics_original: l.lyrics_romanized,
    ...(l.lyrics_translation_zh ? { lyrics_zh: l.lyrics_translation_zh } : {}),
    ...(l.lyrics_translation_en ? { lyrics_en: l.lyrics_translation_en } : {}),
    ...(l.lyrics_source         ? { source:    l.lyrics_source }         : {}),
    show_publicly:   l.show_publicly ?? false,
  };

  const { error } = await supabase
    .from('lyrics')
    .upsert(row, { onConflict: 'song_id', ignoreDuplicates: false });

  if (error) {
    console.error(`  FAIL  ${song.title_original || '?'}:`, error.message);
    fail++;
  } else {
    const prev = existing ? `(was: publicly=${existing.show_publicly}, orig=${existing.lyrics_original ? 'set' : 'null'})` : '(new row)';
    console.log(`  OK    ${song.title_original || song.title_romanized || '?'}  ${prev}`);
    ok++;
  }
}

console.log(`\nDone. ${ok} migrated, ${noMatch} no match, ${fail} failed.`);
