/**
 * Pass 1 — fill yt_title and artist_credit from YouTube oEmbed.
 * No API key, no AI. Run: node scripts/fix-yt-metadata.mjs
 * Safe to re-run: only updates fields that are currently null/empty.
 */

import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

async function sbFetch(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(id, patch) {
  const res = await fetch(`${SB_URL}/rest/v1/songs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

async function getOembed(ytUrl) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Fetch all songs that have a YouTube URL
const songs = await sbFetch(
  'songs?select=id,yt_url,yt_title,artist_credit&yt_url=not.is.null&limit=500'
);

const targets = songs.filter(s => !s.yt_title || !s.artist_credit);
console.log(`${songs.length} songs with YT URL — ${targets.length} need yt_title or artist_credit`);

let updatedTitle  = 0;
let updatedArtist = 0;
let failed        = 0;
let skipped       = 0;

for (let i = 0; i < targets.length; i++) {
  const song = targets[i];
  process.stdout.write(`[${i + 1}/${targets.length}] ${song.id} … `);

  const oembed = await getOembed(song.yt_url);
  if (!oembed) {
    console.log('❌ oEmbed failed');
    failed++;
    continue;
  }

  const patch = {};
  if (!song.yt_title    && oembed.title)       patch.yt_title      = oembed.title;
  if (!song.artist_credit && oembed.author_name) patch.artist_credit = oembed.author_name;

  if (!Object.keys(patch).length) {
    console.log('— already complete');
    skipped++;
    continue;
  }

  const ok = await sbPatch(song.id, patch);
  if (ok) {
    const parts = [];
    if (patch.yt_title)      { parts.push(`yt_title="${patch.yt_title}"`);           updatedTitle++;  }
    if (patch.artist_credit) { parts.push(`artist_credit="${patch.artist_credit}"`); updatedArtist++; }
    console.log(`✓ ${parts.join(', ')}`);
  } else {
    console.log('❌ DB update failed');
    failed++;
  }

  // Polite delay — YouTube oEmbed has no official rate limit but let's not hammer it
  await new Promise(r => setTimeout(r, 150));
}

console.log(`\nDone.`);
console.log(`  yt_title updated:      ${updatedTitle}`);
console.log(`  artist_credit updated: ${updatedArtist}`);
console.log(`  failed:                ${failed}`);
console.log(`  already complete:      ${skipped}`);
console.log(`\nNote: artist_credit from oEmbed is the YouTube channel name — review and correct as needed.`);
