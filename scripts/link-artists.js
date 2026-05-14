/**
 * scripts/link-artists.js
 *
 * Resolves song.artist strings to artist IDs from artists.json.
 * Supports multi-artist strings: "A feat. B", "A & B", "A and B", "A x B".
 * Writes artist_ids[] back into each song (all matched IDs, primary first).
 * Unmatched parts go to data/artists_unlinked.json for review.
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

// ── Split a compound artist string into individual parts ─────────────────────
// Handles: "A feat. B", "A ft. B", "A & B", "A and B", "A x B", "A, B"
// Returns an array of candidate strings to resolve independently.
function splitArtistString(raw) {
  // Split on separators, preserving each chunk for individual resolution
  const parts = raw
    .split(/\s+(?:feat\.?|ft\.?|and|&|[×x])\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

// ── Resolve a single name string to an artist ID ─────────────────────────────
function resolveOne(str) {
  if (!str || str === 'Unknown / Traditional') return null;

  const lower = str.toLowerCase().trim();

  // 1. Exact match
  let id = aliasMap.get(lower);
  if (id) return id;

  // 2. Strip trailing parenthetical romanization e.g. "盧靜子 (Lu Jingzi)" → "盧靜子"
  const noParens = str.replace(/\s*\(.*?\)\s*$/, '').trim();
  id = aliasMap.get(noParens.toLowerCase());
  if (id) return id;

  // 3. Try the content inside the parens e.g. "(Lu Jingzi)" → "Lu Jingzi"
  const insideParens = (str.match(/\(([^)]+)\)/) || [])[1]?.trim();
  if (insideParens) {
    id = aliasMap.get(insideParens.toLowerCase());
    if (id) return id;
  }

  // 4. Try each whitespace/paren-cleaned token individually (len > 2)
  const tokens = lower.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  for (const token of tokens) {
    id = aliasMap.get(token);
    if (id) return id;
  }

  // 5. Alias substring containment (alias must be > 2 chars to avoid false matches)
  for (const [alias, aid] of aliasMap) {
    if (alias.length > 2 && lower.includes(alias)) return aid;
  }

  return null;
}

// ── Resolve a full artist string → array of IDs ──────────────────────────────
function resolveArtistIds(artistStr) {
  const parts = splitArtistString(artistStr);
  const ids = [];
  const unresolved = [];

  for (const part of parts) {
    const id = resolveOne(part);
    if (id && !ids.includes(id)) {
      ids.push(id);
    } else if (!id) {
      unresolved.push(part);
    }
  }

  return { ids, unresolved };
}

// ── Link songs ────────────────────────────────────────────────────────────────
const unlinkedStrings = new Set();
let fullyLinked = 0, partiallyLinked = 0, skipped = 0, totalUnlinked = 0;

for (const song of songs) {
  if (!song.artist || song.artist === 'Unknown / Traditional') {
    song.artist_ids = [];
    skipped++;
    continue;
  }

  const { ids, unresolved } = resolveArtistIds(song.artist);
  song.artist_ids = ids;

  if (ids.length > 0 && unresolved.length === 0) {
    fullyLinked++;
  } else if (ids.length > 0 && unresolved.length > 0) {
    partiallyLinked++;
    for (const u of unresolved) unlinkedStrings.add(u);
  } else {
    totalUnlinked++;
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

console.log(`✓ Fully linked:     ${fullyLinked} songs`);
console.log(`◑ Partially linked: ${partiallyLinked} songs (some feat. artists unresolved)`);
console.log(`○ Skipped:          ${skipped} songs (Unknown/Traditional or no artist)`);
console.log(`✗ Unlinked:         ${totalUnlinked} songs (no match at all)`);
console.log(`  → ${unlinkedStrings.size} unique unresolved strings in data/artists_unlinked.json`);
