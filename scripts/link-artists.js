/**
 * scripts/link-artists.js
 *
 * Resolves song.artist strings to artist IDs from artists.json.
 * Writes artist_ids[] back into each song.
 * Unmatched strings go to data/artists_unlinked.json for review.
 *
 * Usage: node scripts/link-artists.js
 */

const fs = require('fs');
const path = require('path');

const ARTISTS_PATH = path.join(__dirname, '../data/artists.json');
const SONGS_PATH   = path.join(__dirname, '../data/songs.json');
const UNLINKED_OUT = path.join(__dirname, '../data/artists_unlinked.json');

const artists = JSON.parse(fs.readFileSync(ARTISTS_PATH, 'utf8'));
const songs   = JSON.parse(fs.readFileSync(SONGS_PATH, 'utf8'));

// ── Build alias → artist_id map ──────────────────────────────────────────────
const aliasMap = new Map(); // lowercase alias -> artist id
for (const a of artists) {
  const aliases = [
    a.name_display,
    ...(a.names_zh || []),
    ...(a.names_rom || []),
    ...(a.names_indigenous || []),
  ].filter(Boolean);
  for (const alias of aliases) {
    aliasMap.set(alias.toLowerCase().trim(), a.id);
  }
}

// ── Matching function ─────────────────────────────────────────────────────────
function findArtistId(songArtist) {
  if (!songArtist || songArtist === 'Unknown / Traditional') return null;

  const lower = songArtist.toLowerCase().trim();

  // 1. Exact match
  let id = aliasMap.get(lower);
  if (id) return id;

  // 2. Strip ' feat. ...' suffix, try again
  const noFeat = songArtist.replace(/\s*feat\..*$/i, '').trim();
  id = aliasMap.get(noFeat.toLowerCase());
  if (id) return id;

  // 3. Try each whitespace/paren token individually (len > 2)
  const tokens = lower.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  for (const token of tokens) {
    id = aliasMap.get(token);
    if (id) return id;
  }

  // 4. Alias substring containment (alias must be > 2 chars to avoid false matches)
  for (const [alias, aid] of aliasMap) {
    if (alias.length > 2 && lower.includes(alias)) return aid;
  }

  return null;
}

// ── Link songs ────────────────────────────────────────────────────────────────
const unlinkedStrings = new Set();
let linked = 0, skipped = 0;

for (const song of songs) {
  if (!song.artist || song.artist === 'Unknown / Traditional') {
    song.artist_ids = [];
    skipped++;
    continue;
  }

  const id = findArtistId(song.artist);
  if (id) {
    song.artist_ids = [id];
    linked++;
  } else {
    song.artist_ids = [];
    unlinkedStrings.add(song.artist);
  }
}

// ── Write outputs ─────────────────────────────────────────────────────────────
fs.writeFileSync(SONGS_PATH, JSON.stringify(songs, null, 2), 'utf8');

const unlinkedOut = [...unlinkedStrings].sort().map(str => ({
  song_artist_string: str,
  suggested_action: 'add to artists.json or manually set artist_ids on songs',
}));
fs.writeFileSync(UNLINKED_OUT, JSON.stringify(unlinkedOut, null, 2), 'utf8');

console.log(`✓ Linked:    ${linked} songs`);
console.log(`○ Skipped:   ${skipped} songs (Unknown/Traditional or no artist)`);
console.log(`✗ Unlinked:  ${unlinkedStrings.size} unique artist strings`);
console.log(`  → See data/artists_unlinked.json for the queue`);
