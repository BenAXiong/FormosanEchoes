# Artist Seed Data — Context & Procedures

## What this folder is

Manually researched artist seed data in JSONL format, produced by ChatGPT with multi-source verification. Each entry contains ethnic lineage sources, name aliases across three scripts, community/birthplace info, music roles, and associated groups.

The goal is to bootstrap the artists table with verified records before the app goes public. A second (final) batch is pending.

---

## Files

| File | Status | Notes |
|---|---|---|
| `verified_artists_batch_01.jsonl` | Imported ✓ | 26 entries; 9 new inserts, 17 already existed. See checks below. |
| `near_misses_or_uncertain_batch_01.jsonl` | Not imported | `include_in_verified_dataset: false`; pending better primary sources before import. |
| `verified_artists_batch_02.jsonl` | Pending | Final batch — import when ready, same script. |

---

## How to import a new batch

```
node scripts/import-artists-seed.mjs --dry-run   # preview
node scripts/import-artists-seed.mjs              # live
```

The script is idempotent (skips existing `name_display`). After running, manually verify the newly inserted records and the existing records that were skipped — check ethnic groups, missing names, and wikipedia URLs against the JSONL data (same checks done below for batch 01).

---

## Ethnic group vocab

JSONL uses slash-format; the DB uses controlled-vocab format. The normalization map is in `scripts/import-artists-seed.mjs`:

| JSONL | DB value |
|---|---|
| Amis / Pangcah | Amis (Pangcah) |
| Puyuma / Pinuyumayan | Puyuma |
| Yami / Tao | Tao (Yami) |
| Others | pass through as-is |

`Sakizaya` and `Puyuma` are not in `data/controlled-vocab.json` but they are valid Taiwan indigenous groups (#15 and #16 of the 16 official groups). The controlled-vocab only lists 11 — it needs expanding when we add ethnic group filtering on the public browser.

---

## Name scripts

| script | Meaning |
|---|---|
| `zh` | Chinese / hanzi names (stage name, given name, aliases) |
| `en` | Latin-script names used in English or Mandarin contexts (stage names, names on album credits aimed at non-indigenous readers) |
| `ab` | Names in an indigenous community's own orthography — Paiwan, Puyuma, Amis, etc. writing systems. These are Latin-alphabet based but are the communities' **primary** writing systems, not transliterations of anything. |

**Important:** Taiwan indigenous names written in Latin script are NOT "romanizations." Romanization implies converting from a non-Latin source script (like Japanese romaji from kana, or pinyin from hanzi). Paiwan, Amis, Bunun and others use Latin-alphabet orthographies as their canonical writing system — "Aljenljeng Tjaluvie" is a Paiwan name, full stop, not a transliteration.

The current import assigned many indigenous names to `en` because the JSONL's `english_or_romanized_name` field overlapped with `indigenous_name`. This is worth revisiting: names clearly in an indigenous orthography (Paiwan, Amis, Puyuma spelling conventions) should be `ab`; names that are stage-name-style Latin forms aimed at general audiences should be `en`.

---

## Batch 01 — post-import audit (2026-05-19)

### Fixes applied to existing (skipped) records

| Artist | Issue | Fix applied |
|---|---|---|
| 雲力思 | ethnic_groups was `["Truku"]` — WRONG | → `["Atayal"]` |
| 依拜維吉 | ethnic_groups was `[]` | → `["Atayal"]` |
| 曾妮 | ethnic_groups was `[]` | → `["Paiwan"]` |
| 蘇瓦那·恩木伊·奇拉雅善 | ethnic_groups was `["Amis (Pangcah)"]` only | → added `"Sakizaya"` |
| 桑布伊 | wikipedia_url null | → added zh-tw Wikipedia URL |
| 王宏恩 | wikipedia_url null | → added zh-tw Wikipedia URL |
| 以莉·高露 | wikipedia_url null | → added zh-tw Wikipedia URL |
| 桑布伊 | missing full indigenous name and alias | → added `Sangpuy Katatepan Mavaliyw` (ab), `桑布伊·卡達德邦·瑪法琉` (zh) |
| 林廣財 | no Latin names in DB at all | → added `Ngerenger Kazangiljan` (ab) |
| 阿洛·卡力亭·巴奇辣 | missing real-name alias + apostrophe form | → added `林佩蓉` (zh), `Ado' Kaliting Pacidal` (en) |
| 依拜維吉 | missing real-name aliases | → added `黃靖紘` (zh), `黃慧文` (zh), `Ipay Buyici` (ab) |

### Minor discrepancies noted but not fixed (verify manually)

| Artist | Issue | Notes |
|---|---|---|
| Kivi | DB has `Kivi Pasulivai`; JSONL has `Kivi Pasurivai` | One letter diff (l vs r). JSONL sourced from govt/news pages — likely more authoritative. Check and correct in admin if confirmed. |
| 少妮瑤·久分勒分 | DB: `Sauniaw Tjuvelijevelj`; JSONL: `Sauniaw Tjuveljevelj` | Minor spelling variant. Verify against Paiwan orthography sources. |
| 依拜維吉 | DB has `Ipay Vigi`; JSONL has `Ipay Buyici` | Both now in DB as separate en/ab entries. `Ipay Buyici` added as ab; `Ipay Vigi` (old entry) left as en since source is unknown. |

### Duplicate names in existing records (pre-existing, not caused by import)

Several artists have duplicate `artist_names` rows (same name + same script twice). Examples: 桑布伊, 郭英男, 蔣進興, 陸森寶, 曾妮, etc. These are harmless for matching but untidy. Clean them up with a DB query when convenient:
```sql
DELETE FROM artist_names
WHERE id NOT IN (
  SELECT MIN(id) FROM artist_names GROUP BY artist_id, name, script
);
```
(Run in Supabase SQL editor — verify row count first.)

---

## Future: fields not yet in DB

The JSONL captures richer data that the current schema doesn't have columns for. These are stored in the `notes` field as structured text for now. When the schema expands, migrate from notes:

| JSONL field | Target DB column (future) |
|---|---|
| `birthplace` | `birthplace_region TEXT` on artists |
| `ancestral_community_or_origin` | `origin_community TEXT` on artists |
| `music_roles` | could become a text[] or drive `artist_roles` table |
| `genres_or_traditions` | `genres TEXT[]` on artists |
| `associated_groups_current_or_former` | `artist_members` table (already exists for groups, needs role/relationship field) |
| `lineage_confidence` | `ethnic_group_confidence TEXT` on artists |
| `lineage_source_urls` | already merged into `sources TEXT[]` ✓ |

---

## Near-misses (uncertain batch)

`near_misses_or_uncertain_batch_01.jsonl` contains 10 artists with `include_in_verified_dataset: false`. The main reason for exclusion is that ethnic lineage sources are primarily Wikipedia / secondary databases rather than government pages, institutional bios, or interviews. These can be upgraded to verified once stronger primary sources are found. Key names: 紀曉君, 陳建年, 家家, 舞思愛, 梁文音, 温嵐, 戴愛玲.

Do NOT import these automatically — each one needs a source upgrade review first.
