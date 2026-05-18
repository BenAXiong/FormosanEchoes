/**
 * One-off: set yt_url + yt_video_id for the "sapuy" song.
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
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

const YT_URL    = 'https://www.youtube.com/watch?v=Di8y_fsT9dw';
const VIDEO_ID  = 'Di8y_fsT9dw';

// Find the song
const findRes = await fetch(
  `${SB_URL}/rest/v1/songs?select=id,title_original,yt_url,yt_title&title_original=ilike.*sapuy*&limit=10`,
  { headers: HEADERS }
);
const songs = await findRes.json();
console.log('Found:', songs);

if (!songs.length) {
  // Try broader search
  const r2 = await fetch(
    `${SB_URL}/rest/v1/songs?select=id,title_original,yt_url,yt_title&yt_title=ilike.*sapuy*&limit=10`,
    { headers: HEADERS }
  );
  const s2 = await r2.json();
  console.log('Found via yt_title:', s2);
  if (!s2.length) { console.error('No sapuy song found.'); process.exit(1); }
  songs.push(...s2);
}

if (songs.length > 1) {
  console.error('Multiple matches — be specific:', songs.map(s => `${s.id} ${s.title_original}`).join('\n'));
  process.exit(1);
}

const song = songs[0];
console.log(`Patching ${song.id} — "${song.title_original ?? song.yt_title}"`);

const patch = { yt_url: YT_URL, yt_video_id: VIDEO_ID };
const patchRes = await fetch(`${SB_URL}/rest/v1/songs?id=eq.${song.id}`, {
  method: 'PATCH',
  headers: { ...HEADERS, 'Prefer': 'return=minimal' },
  body: JSON.stringify(patch),
});

console.log(patchRes.ok ? '✓ Done' : `❌ Failed: ${await patchRes.text()}`);
