/**
 * Pass 2 — AI metadata verification for all songs.
 * Uses Gemini 2.5 Pro with web search to verify/correct:
 *   title_original, title_zh, artist_credit
 *
 * Saves incremental change log to scripts/pass2-changes.json
 * Safe to re-run: skips songs already in the log.
 *
 * Run: node scripts/ai-metadata-pass2.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- env ---
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SB_URL    = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = env.GEMINI_API_KEY;

if (!SB_URL || !SB_KEY || !GEMINI_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY in .env.local');
  process.exit(1);
}

const SB_HEADERS = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
};

// --- change log (resume-safe) ---
const LOG_PATH = new URL('./pass2-changes.json', import.meta.url);
const skippedLog = new URL('./pass2-skipped.json', import.meta.url);

const changes = existsSync(LOG_PATH) ? JSON.parse(readFileSync(LOG_PATH, 'utf8')) : [];
const skipped = existsSync(skippedLog) ? JSON.parse(readFileSync(skippedLog, 'utf8')) : [];
const processedIds = new Set([...changes.map(c => c.id), ...skipped.map(s => s.id)]);

function saveLog() {
  writeFileSync(LOG_PATH, JSON.stringify(changes, null, 2));
  writeFileSync(skippedLog, JSON.stringify(skipped, null, 2));
}

// --- fetch all songs ---
const res = await fetch(
  `${SB_URL}/rest/v1/songs?select=id,yt_title,yt_url,title_original,title_zh,artist_credit,language,ethnic_group&order=created_at.asc&limit=2000`,
  { headers: SB_HEADERS }
);
const allSongs = await res.json();
const songs = allSongs.filter(s => !processedIds.has(s.id));

console.log(`${allSongs.length} total songs — ${processedIds.size} already processed — ${songs.length} to review`);
if (!songs.length) { console.log('Nothing to do.'); process.exit(0); }

// --- Gemini setup ---
const genai = new GoogleGenerativeAI(GEMINI_KEY);
const model = genai.getGenerativeModel(
  { model: 'gemini-2.5-pro', tools: [{ googleSearch: {} }] },
  { timeout: 90_000 }
);

const SYSTEM_PROMPT = `You are a metadata expert for Indigenous Taiwanese (Formosan) music.

Given current song metadata, use web search to verify and correct it.
Return ONLY a valid JSON object — no markdown fences, no extra text:

{
  "title_original": <string or null>,
  "title_zh": <string or null>,
  "artist_credit": <string or null>,
  "change_notes": <string or null>
}

Rules:
• title_original — romanized or indigenous-script song title (primary song name in its own language)
• title_zh — Chinese title, Traditional Chinese preferred
• artist_credit — the real performing artist's name (not a YouTube channel name)
  - Strip " - Topic" from auto-generated topic channels (e.g. "Suming - Topic" → "Suming Shih" / 舒米恩)
  - If channel is an uploader/aggregator (e.g. "原視 TITV+", "HoHoBa 🍀Love🍀") find the actual performing artist from the video
  - Use the artist's most commonly recognised name; include Chinese name if widely used
• Return unchanged values as-is — only populate a field when you are confident it is correct or an improvement
• Set a field to null only if you truly cannot determine it
• change_notes: one short sentence saying what changed and why; null if nothing changed`;

// --- process ---
let countChanged = 0;
let countNoChange = 0;
let countError = 0;

for (let i = 0; i < songs.length; i++) {
  const s = songs[i];
  const label = s.title_original || s.yt_title || `(${s.id.slice(0, 8)})`;
  process.stdout.write(`[${i + 1}/${songs.length}] ${label} … `);

  const userMessage = [
    `YouTube title: ${s.yt_title ?? '(none)'}`,
    `YouTube URL:   ${s.yt_url   ?? '(none)'}`,
    `title_original: ${s.title_original ?? '(none)'}`,
    `title_zh:       ${s.title_zh       ?? '(none)'}`,
    `artist_credit:  ${s.artist_credit  ?? '(none)'}`,
    `language:       ${s.language       ?? '(none)'}`,
    `ethnic_group:   ${s.ethnic_group   ?? '(none)'}`,
  ].join('\n');

  try {
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);
    const text = result.response.text().trim();

    // Extract JSON (strip any accidental fences)
    const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!match) {
      console.log('⚠ No JSON in response');
      skipped.push({ id: s.id, label, reason: 'no_json', raw: text.slice(0, 200) });
      countError++;
      saveLog();
      continue;
    }

    let ai;
    try { ai = JSON.parse(match[0]); }
    catch {
      console.log('⚠ JSON parse error');
      skipped.push({ id: s.id, label, reason: 'parse_error', raw: match[0].slice(0, 200) });
      countError++;
      saveLog();
      continue;
    }

    // Compute diff — only update fields Gemini is confident about
    const patch = {};
    const diff  = {};
    for (const field of ['title_original', 'title_zh', 'artist_credit']) {
      const current  = s[field]   ?? null;
      const proposed = ai[field]  ?? null;
      if (proposed && proposed !== current) {
        patch[field] = proposed;
        diff[field]  = { from: current, to: proposed };
      }
    }

    if (!Object.keys(patch).length) {
      console.log('— no changes');
      skipped.push({ id: s.id, label, reason: 'no_change' });
      countNoChange++;
      saveLog();
      continue;
    }

    // Write to DB
    const patchRes = await fetch(`${SB_URL}/rest/v1/songs?id=eq.${s.id}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(patch),
    });

    if (patchRes.ok) {
      const fields = Object.keys(diff).join(', ');
      console.log(`✓ [${fields}]`);
      changes.push({
        id: s.id,
        yt_title: s.yt_title,
        original_title_for_context: label,
        changes: diff,
        notes: ai.change_notes ?? null,
      });
      countChanged++;
    } else {
      const errText = await patchRes.text();
      console.log(`❌ DB error: ${errText}`);
      skipped.push({ id: s.id, label, reason: 'db_error', raw: errText });
      countError++;
    }
    saveLog();
  } catch (err) {
    console.log(`❌ ${err.message}`);
    skipped.push({ id: s.id, label, reason: 'exception', raw: err.message });
    countError++;
    saveLog();
  }

  // 2.5s between calls — respectful of Gemini rate limits
  await new Promise(r => setTimeout(r, 2500));
}

saveLog();
console.log(`
Done.
  Modified:    ${countChanged}
  No changes:  ${countNoChange}
  Errors:      ${countError}

Change log:  scripts/pass2-changes.json
Skipped log: scripts/pass2-skipped.json
`);
