/**
 * scripts/import_notion_csv.mjs
 * Imports data/imports/notion_songs_full.csv into data/songs.mock.json
 * Run with: node scripts/import_notion_csv.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

// ── CSV Parser (handles multi-line quoted fields) ────────────────────────────
function parseCsv(content) {
  content = content.replace(/^\uFEFF/, ''); // strip BOM
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (inQ && content[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      row.push(field); field = '';
    } else if ((c === '\n' || (c === '\r' && content[i + 1] === '\n')) && !inQ) {
      if (c === '\r') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── Config ────────────────────────────────────────────────────────────────────
const FORMOSAN_LANGUAGES = new Set([
  'Amis', 'Atayal', 'Paiwan', 'Bunun', 'Puyuma', 'Rukai',
  'Tsou', 'Saisiyat', 'Tao (Yami)', 'Thao', 'Kavalan',
  'Truku', 'Sakizaya', 'Seediq', "Hla'alua", 'Kanakanavu',
  // alternate spellings from the CSV
  'Tao', 'Yami',
]);

const LANG_TO_ETHNIC = {
  'Amis': 'Amis (Pangcah)', 'Atayal': 'Atayal', 'Paiwan': 'Paiwan',
  'Bunun': 'Bunun', 'Puyuma': 'Puyuma', 'Rukai': 'Rukai',
  'Tsou': 'Tsou', 'Saisiyat': 'Saisiyat', 'Tao': 'Tao (Yami)',
  'Tao (Yami)': 'Tao (Yami)', 'Yami': 'Tao (Yami)', 'Thao': 'Thao',
  'Kavalan': 'Kavalan', 'Truku': 'Truku', 'Sakizaya': 'Sakizaya',
  'Seediq': 'Seediq', "Hla'alua": "Hla'alua", 'Kanakanavu': 'Kanakanavu',
};

const STATUS_MAP = {
  'In progress': 'needs_review',
  'Not Started': 'candidate',
  '': 'candidate',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const isChinese = (s) => /[\u4e00-\u9fff]/.test(s);
const isLatinScript = (s) => /[a-zA-Z]/.test(s);
const stripPrefix = (s) => s.replace(/^[\s\*？?]+/, '').trim();
const extractYtId = (url) => {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const makeYtUrl = (url) => {
  if (!url) return null;
  // Strip playlist params, keep clean watch URL
  const id = extractYtId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
};

// ── Load existing data ────────────────────────────────────────────────────────
const existing = JSON.parse(readFileSync('data/songs.mock.json', 'utf8'));
const existingYtIds = new Set(existing.map(s => extractYtId(s.youtube_url)).filter(Boolean));
const existingTitles = new Set(existing.map(s => (s.title_romanized || s.title_chinese || s.title_original || '').toLowerCase().trim()).filter(Boolean));

let nextId = existing.length + 1; // sof-008 onwards
const pad = (n) => String(n).padStart(3, '0');

// ── Parse CSV ─────────────────────────────────────────────────────────────────
const csvContent = readFileSync('data/imports/notion_songs_full.csv', 'utf8');
const rows = parseCsv(csvContent);
const headers = rows[0];
console.log('CSV headers:', headers);
console.log('Total CSV rows:', rows.length - 1);

const COL = {
  name:     headers.findIndex(h => h.replace(/^\uFEFF/, '').trim() === 'Name - original'),
  album:    headers.findIndex(h => h.trim() === 'Album'),
  language: headers.findIndex(h => h.trim() === 'Language'),
  learn:    headers.findIndex(h => h.trim() === 'Learn?'),
  link:     headers.findIndex(h => h.trim() === 'Link'),
  lyrics:   headers.findIndex(h => h.trim() === 'Lyrics'),
  nameEn:   headers.findIndex(h => h.trim() === 'Name - EN'),
  nameZw:   headers.findIndex(h => h.trim() === 'Name - ZW'),
  singer:   headers.findIndex(h => h.trim() === 'Singer'),
  status:   headers.findIndex(h => h.trim() === 'Status'),
  top:      headers.findIndex(h => h.trim() === 'Top'),
};
console.log('Column indexes:', COL);

const imported = [];
const skipped = [];

for (const row of rows.slice(1)) {
  if (row.length < 5) continue; // empty row

  const rawName   = (row[COL.name] || '').trim();
  const language  = (row[COL.language] || '').trim();
  const link      = (row[COL.link] || '').trim();
  const lyricsRaw = (row[COL.lyrics] || '').trim();
  const singer    = (row[COL.singer] || '').trim();
  const nameZw    = (row[COL.nameZw] || '').trim();
  const nameEn    = (row[COL.nameEn] || '').trim();
  const album     = (row[COL.album] || '').trim();
  const statusRaw = (row[COL.status] || '').trim();
  const learn     = (row[COL.learn] || '').trim() === 'Yes';
  const top       = (row[COL.top] || '').trim() === 'Yes';

  // 1. Filter non-Formosan
  if (!FORMOSAN_LANGUAGES.has(language)) {
    skipped.push({ reason: `non-Formosan language: "${language}"`, name: rawName });
    continue;
  }

  // 2. Clean title
  const cleanedName = stripPrefix(rawName);
  if (!cleanedName) {
    skipped.push({ reason: 'empty name', name: rawName });
    continue;
  }

  // 3. Deduplicate by YouTube ID
  const ytUrl = makeYtUrl(link);
  const ytId = extractYtId(link);
  if (ytId && existingYtIds.has(ytId)) {
    skipped.push({ reason: `duplicate YouTube ID: ${ytId}`, name: cleanedName });
    continue;
  }

  // 4. Deduplicate by title (loose match)
  const titleKey = cleanedName.toLowerCase();
  if (existingTitles.has(titleKey)) {
    skipped.push({ reason: `duplicate title: "${cleanedName}"`, name: cleanedName });
    continue;
  }

  // 5. Determine title fields
  let title_original = null, title_romanized = null, title_chinese = null;
  if (isChinese(cleanedName) && !isLatinScript(cleanedName)) {
    // Pure Chinese title
    title_original = cleanedName;
    title_chinese = cleanedName;
  } else {
    // Latin/romanized title (possibly with Chinese mixed — keep as original)
    title_romanized = cleanedName;
    title_original = cleanedName;
  }
  // ZW column → title_chinese
  if (nameZw && !title_chinese) {
    // ZW field can have multiple names separated by newlines — take first
    title_chinese = nameZw.split('\n')[0].trim();
    // Strip disambiguation notes like （後面的）
    title_chinese = title_chinese.replace(/（[^）]+）/g, '').trim();
  }

  // 6. Tags
  const tags = [language.toLowerCase().replace(/[\s()/]/g, '-')];
  if (learn) tags.push('learn');
  if (top) tags.push('top');

  // 7. Build song object
  const id = `sof-${pad(nextId++)}`;
  const song = {
    id,
    title_original,
    title_romanized,
    title_chinese: title_chinese || null,
    artist: singer || null,
    language_claimed: language,
    language_evidence: `Notion research database. Language: ${language}.`,
    ethnic_group_claimed: LANG_TO_ETHNIC[language] || language,
    ethnic_group_evidence: 'Inferred from language_claimed.',
    performers: [],
    source_platform: ytUrl ? 'YouTube' : null,
    url: ytUrl,
    youtube_url: ytUrl,
    lyrics_url: null,
    album_or_source: album || null,
    year: null,
    location_claimed: null,
    region: null,
    genre: null,
    tags,
    source_snippets: nameEn ? `English title: ${nameEn}` : null,
    verification_notes: 'Imported from Notion research database. Requires manual verification.',
    confidence: 'unknown',
    verification_status: STATUS_MAP[statusRaw] ?? 'candidate',
    needs_manual_verification: true,
    checked_by_me: false,
    date_added: new Date().toISOString().slice(0, 10),
  };

  // 8. Lyrics (only romanized available from CSV)
  if (lyricsRaw) {
    song.lyrics = {
      song_id: id,
      lyrics_original: null,
      lyrics_romanized: lyricsRaw,
      lyrics_translation_zh: null,
      lyrics_translation_en: null,
      lyrics_source: 'Notion research database.',
      lyrics_rights_status: 'unverified_transcription',
      lyrics_notes: '[TESTING] show_publicly enabled for UI dev.',
      has_permission: false,
      show_publicly: true,
    };
  }

  // Register for deduplication
  if (ytId) existingYtIds.add(ytId);
  existingTitles.add(titleKey);

  imported.push(song);
}

// ── Write output ──────────────────────────────────────────────────────────────
const merged = [...existing, ...imported];
writeFileSync('data/songs.mock.json', JSON.stringify(merged, null, 2), 'utf8');

console.log('\n=== Import complete ===');
console.log(`Imported: ${imported.length} new songs`);
console.log(`Existing: ${existing.length} songs`);
console.log(`Total:    ${merged.length} songs`);
console.log(`Skipped:  ${skipped.length} rows`);
console.log('\nSkip reasons:');
const reasons = {};
skipped.forEach(s => { reasons[s.reason.split(':')[0]] = (reasons[s.reason.split(':')[0]] || 0) + 1; });
Object.entries(reasons).forEach(([k, v]) => console.log(`  ${v}x ${k}`));
console.log('\nNew songs by language:');
const byLang = {};
imported.forEach(s => { byLang[s.language_claimed] = (byLang[s.language_claimed] || 0) + 1; });
Object.entries(byLang).sort((a,b) => b[1]-a[1]).forEach(([l, n]) => console.log(`  ${n}x ${l}`));
