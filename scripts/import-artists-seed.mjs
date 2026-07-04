/**
 * Import verified artists from a seed JSONL file into Supabase.
 * into Supabase.
 *
 * - Strips markdown code fences from the JSONL file
 * - Normalizes ethnic group vocab to match controlled-vocab.json
 * - Deduplicates by name_display before inserting
 * - Inserts artist row + artist_names rows (zh / en / ab scripts)
 * - Stores rich seed metadata (roles, genres, community, confidence) in notes field
 *
 * Run: node scripts/import-artists-seed.mjs [path/to/file.jsonl] [--dry-run]
 * Defaults to verified_artists_batch_01.jsonl when no path given.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const fileArg = process.argv.find(a => a.endsWith('.jsonl'));
const DEFAULT_FILE = 'scratch/deep_search_artists/verified_artists_batch_01.jsonl';

// --- env ---
const env = Object.fromEntries(
  readFileSync(join(__dirname, '../.env.local'), 'utf8')
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

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// --- Ethnic group normalisation ---
// Maps JSONL values → controlled-vocab.json values
const ETHNIC_GROUP_MAP = {
  'Amis / Pangcah':      'Amis (Pangcah)',
  'Amis':                'Amis (Pangcah)',
  'Puyuma / Pinuyumayan':'Puyuma',       // not yet in controlled-vocab but correct canonical name
  'Puyuma':              'Puyuma',
  'Yami / Tao':          'Tao (Yami)',
  'Tao':                 'Tao (Yami)',
  'Sakizaya':            'Sakizaya',
  'Atayal':              'Atayal',
  'Paiwan':              'Paiwan',
  'Bunun':               'Bunun',
  'Tsou':                'Tsou',
  'Rukai':               'Rukai',
  'Truku':               'Truku',
  'Saisiyat':            'Saisiyat',
  'Seediq':              'Seediq',
  'Kavalan':             'Kavalan',
  'Thao':                'Thao',
  'Kanakanavu':          'Kanakanavu',
  'Saaroa':              'Saaroa',
};

function normalizeEthnicGroup(g) {
  return ETHNIC_GROUP_MAP[g] ?? g;
}

// Returns true if string contains CJK characters
function hasChinese(s) {
  return /[㐀-鿿豈-﫿]/.test(s);
}

// Splits a compound display name like "阿爆 Abao" or "Makav 真愛" into
// its Chinese and Latin portions.
function splitDisplayName(displayName) {
  const parts = displayName.trim().split(/\s+/);
  const zhParts = [];
  const enParts = [];
  for (const p of parts) {
    if (hasChinese(p)) zhParts.push(p);
    else enParts.push(p);
  }
  return {
    zh: zhParts.length > 0 ? zhParts.join('') : null,
    en: enParts.length > 0 ? enParts.join(' ') : null,
  };
}

// --- Load JSONL ---
const rawContent = readFileSync(
  fileArg ? join(__dirname, '..', fileArg) : join(__dirname, '..', DEFAULT_FILE),
  'utf8'
);

// Strip markdown code fences (```jsonl ... ```)
const lines = rawContent
  .split('\n')
  .filter(l => !l.startsWith('```'))
  .map(l => l.trim())
  .filter(l => l.length > 0);

const entries = lines
  .map(l => JSON.parse(l))
  .filter(e => e.include_in_verified_dataset === true);

console.log(`Loaded ${entries.length} verified entries from JSONL`);
if (DRY_RUN) console.log('--- DRY RUN — no writes ---');

// --- Fetch existing artists to check for duplicates ---
const existingRes = await fetch(
  `${SB_URL}/rest/v1/artists?select=name_display&limit=5000`,
  { headers: SB_HEADERS }
);
if (!existingRes.ok) {
  console.error('Failed to fetch existing artists:', await existingRes.text());
  process.exit(1);
}
const existingArtists = await existingRes.json();
const existingNames = new Set(existingArtists.map(a => a.name_display));
console.log(`${existingNames.size} existing artists in DB\n`);

// --- Process each entry ---
let inserted = 0;
let skipped = 0;
let errors = 0;

for (const entry of entries) {
  const displayName = entry.primary_display_name;

  if (existingNames.has(displayName)) {
    console.log(`  SKIP   ${displayName} (already exists)`);
    skipped++;
    continue;
  }

  const ethnicGroups = (entry.ethnic_groups ?? []).map(normalizeEthnicGroup);

  // Collect all unique source URLs
  const sourcesSet = new Set([
    ...(entry.lineage_source_urls ?? []),
    ...(entry.other_source_urls ?? []),
    ...((entry.source_log ?? []).map(s => s.url).filter(Boolean)),
  ]);
  if (entry.wikipedia_url) sourcesSet.add(entry.wikipedia_url);
  const sources = [...sourcesSet].filter(Boolean);

  const youtubeChannel = (entry.youtube_urls ?? [])[0] ?? null;

  // Build human-readable notes from rich seed fields
  const noteParts = [];
  if (entry.ethnic_lineage_note) noteParts.push(`族裔來源：${entry.ethnic_lineage_note}`);
  if (entry.lineage_confidence) noteParts.push(`可信度：${entry.lineage_confidence}`);
  if ((entry.music_roles ?? []).length > 0) noteParts.push(`音樂角色：${entry.music_roles.join(', ')}`);
  if ((entry.genres_or_traditions ?? []).length > 0) noteParts.push(`風格：${entry.genres_or_traditions.join(', ')}`);

  const bplace = entry.birthplace;
  if (bplace && (bplace.tribe_or_community || bplace.village_or_neighborhood || bplace.township_city || bplace.county_city)) {
    const p = [bplace.tribe_or_community, bplace.village_or_neighborhood, bplace.township_city, bplace.county_city].filter(Boolean);
    noteParts.push(`出生地：${p.join('，')}`);
  }

  const origin = entry.ancestral_community_or_origin;
  if (origin && (origin.community || origin.township_city || origin.county_city)) {
    const p = [origin.community, origin.township_city, origin.county_city].filter(Boolean);
    noteParts.push(`祖籍部落：${p.join('，')}`);
  }

  const assocGroups = entry.associated_groups_current_or_former ?? [];
  if (assocGroups.length > 0) {
    const gs = assocGroups.map(g => `${g.group_name}（${g.relationship}）`);
    noteParts.push(`相關團體：${gs.join('；')}`);
  }

  if (entry.verification_notes) noteParts.push(`驗證備註：${entry.verification_notes}`);

  const notes = noteParts.length > 0 ? noteParts.join('\n') : null;

  if (DRY_RUN) {
    console.log(`  WOULD INSERT: ${displayName} (${ethnicGroups.join(', ')})`);
    console.log(`    sources: ${sources.length}, youtube: ${youtubeChannel ?? 'none'}`);
    inserted++;
    existingNames.add(displayName);
    continue;
  }

  // --- INSERT artist ---
  const artistRes = await fetch(`${SB_URL}/rest/v1/artists`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify({
      name_display: displayName,
      ethnic_groups: ethnicGroups,
      is_group: entry.entry_type === 'group',
      wikipedia_url: entry.wikipedia_url ?? null,
      youtube_channel: youtubeChannel,
      sources,
      notes,
    }),
  });

  if (!artistRes.ok) {
    console.error(`  ERROR  ${displayName}: ${await artistRes.text()}`);
    errors++;
    continue;
  }

  const [artist] = await artistRes.json();
  const artistId = artist.id;

  // --- Build artist_names rows ---
  // Use a map keyed by normalised name to deduplicate
  const nameMap = new Map(); // name → script

  // 1. Extract Chinese / Latin portions of the display name itself
  const { zh: dnZh, en: dnEn } = splitDisplayName(displayName);
  if (dnZh) nameMap.set(dnZh, 'zh');
  if (dnEn) nameMap.set(dnEn, 'en');
  // If display_name is purely one script, store it directly
  if (!dnZh && !dnEn) {
    nameMap.set(displayName, hasChinese(displayName) ? 'zh' : 'en');
  }

  // 2. Explicit fields — these win over display_name split (same key → overwrite)
  if (entry.indigenous_name) nameMap.set(entry.indigenous_name, 'ab');
  if (entry.chinese_name) nameMap.set(entry.chinese_name, 'zh');
  if (entry.english_or_romanized_name) nameMap.set(entry.english_or_romanized_name, 'en');

  // 3. Aliases — detect script
  for (const alias of (entry.other_aliases ?? [])) {
    if (!nameMap.has(alias)) {
      nameMap.set(alias, hasChinese(alias) ? 'zh' : 'en');
    }
  }

  const nameRows = [...nameMap.entries()].map(([name, script]) => ({ artist_id: artistId, name, script }));

  if (nameRows.length > 0) {
    const namesRes = await fetch(`${SB_URL}/rest/v1/artist_names`, {
      method: 'POST',
      headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify(nameRows),
    });
    if (!namesRes.ok) {
      console.warn(`  WARN   names insert failed for ${displayName}: ${await namesRes.text()}`);
    }
  }

  console.log(`  OK     ${displayName} (${ethnicGroups.join(', ')}) — ${nameRows.length} names, ${sources.length} sources`);
  inserted++;
  existingNames.add(displayName);
}

console.log(`\nDone.  Inserted: ${inserted}  Skipped: ${skipped}  Errors: ${errors}`);
