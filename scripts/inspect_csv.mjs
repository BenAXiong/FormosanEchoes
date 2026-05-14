import { readFileSync } from 'fs';
const content = readFileSync('data/Songs d433ceeafdfa4f62b9f6807050fe9366_all.csv', 'utf8').replace(/^\uFEFF/, '');
// The CSV has multi-line quoted fields; do a proper parse
let rows = [];
let cur = [], field = '', inQ = false;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '"') {
    if (inQ && content[i+1] === '"') { field += '"'; i++; }
    else inQ = !inQ;
  } else if (c === ',' && !inQ) { cur.push(field); field = ''; }
  else if ((c === '\n' || (c === '\r' && content[i+1] === '\n')) && !inQ) {
    if (c === '\r') i++;
    cur.push(field); rows.push(cur); cur = []; field = '';
  } else { field += c; }
}
if (field || cur.length) { cur.push(field); rows.push(cur); }

const headers = rows[0];
console.log('Headers:', headers.map((h,i) => `[${i}] ${h}`).join('\n'));
console.log('\nTotal data rows:', rows.length - 1);
console.log('\n--- Sample rows ---');
rows.slice(1, 5).forEach((r, i) => {
  console.log(`\nRow ${i+1}:`);
  console.log('  Name-orig:', r[0]);
  console.log('  Language:', r[5]);
  console.log('  Link:', r[7] ? r[7].substring(0, 60) : '');
  console.log('  Name-ZW:', r[10] ? r[10].substring(0, 80) : '');
  console.log('  Singer:', r[11]);
  console.log('  Status:', r[12]);
  console.log('  Has lyrics:', !!r[8]);
});
