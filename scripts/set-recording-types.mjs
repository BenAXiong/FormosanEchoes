// Run with: node scripts/set-recording-types.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } },
);

const updates = [
  { pattern: '馬蘭姑娘',                    recording_type: 'Studio' },
  { pattern: 'Tjakudain',                   recording_type: 'Home Recording' },
  { pattern: 'Aka Pisawad',                 recording_type: 'Studio' },
  { pattern: '思念',                        recording_type: 'Studio' },
  { pattern: '木瓜歌',                      recording_type: 'Live' },
];

for (const { pattern, recording_type } of updates) {
  const { data, error } = await supabase
    .from('songs')
    .update({ recording_type })
    .or(`title_original.ilike.%${pattern}%,title_zh.ilike.%${pattern}%,artist_credit.ilike.%${pattern}%`)
    .select('id, title_original, title_zh, recording_type');

  if (error) {
    console.error(`✗ "${pattern}":`, error.message);
  } else if (!data.length) {
    console.warn(`⚠ "${pattern}": no songs matched`);
  } else {
    for (const s of data) {
      console.log(`✓ [${recording_type}] ${s.title_original ?? s.title_zh}`);
    }
  }
}
