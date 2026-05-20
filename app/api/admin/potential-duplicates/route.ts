import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerClient();

  const [
    { data: rawNames },
    { data: songArtists },
    { data: artistMembers },
    { data: artistsRaw },
    { data: songsRaw },
  ] = await Promise.all([
    supabase.from('artist_names').select('artist_id, name, script'),
    supabase.from('song_artists').select('song_id, artist_id'),
    supabase.from('artist_members').select('group_artist_id, member_artist_id'),
    supabase.from('artists').select('id, name_display, ethnic_groups, language, is_group, photo_url, bio_en, bio_zh, youtube_channel, wikipedia_url, active_years'),
    supabase.from('songs').select('id, title, title_original, yt_title').limit(5000),
  ]);

  // Per-artist name lists (display) + normalized name → artist_ids (overlap detection)
  const namesByArtist = new Map<string, { name: string; script: string }[]>();
  const nameToArtists = new Map<string, string[]>();

  for (const row of rawNames ?? []) {
    const list = namesByArtist.get(row.artist_id) ?? [];
    list.push({ name: row.name, script: row.script });
    namesByArtist.set(row.artist_id, list);

    const norm = row.name.trim().toLowerCase();
    if (norm.length < 2) continue;
    const ids = nameToArtists.get(norm) ?? [];
    if (!ids.includes(row.artist_id)) ids.push(row.artist_id);
    nameToArtists.set(norm, ids);
  }

  // Song title map + song → [artist_ids] + song counts per artist
  const songTitleMap = new Map<string, string>();
  for (const s of songsRaw ?? []) {
    songTitleMap.set(s.id, s.title_original ?? s.yt_title ?? s.title);
  }

  const songToArtists = new Map<string, string[]>();
  const artistSongCount = new Map<string, number>();
  const artistSongs = new Map<string, string[]>(); // artist_id → song_ids
  for (const row of songArtists ?? []) {
    const ids = songToArtists.get(row.song_id) ?? [];
    if (!ids.includes(row.artist_id)) ids.push(row.artist_id);
    songToArtists.set(row.song_id, ids);
    artistSongCount.set(row.artist_id, (artistSongCount.get(row.artist_id) ?? 0) + 1);
    const sids = artistSongs.get(row.artist_id) ?? [];
    sids.push(row.song_id);
    artistSongs.set(row.artist_id, sids);
  }

  // Intentional group/member pairs — exclude from duplicate detection
  const memberPairs = new Set<string>();
  for (const row of artistMembers ?? []) {
    memberPairs.add(`${row.group_artist_id}|${row.member_artist_id}`);
    memberPairs.add(`${row.member_artist_id}|${row.group_artist_id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artistMap = new Map((artistsRaw ?? []).map((a: any) => [a.id, a]));
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  type PairData = {
    a: string; b: string;
    reason: 'name_overlap' | 'shared_song';
    shared_names: string[];
    shared_songs: string[];
    confidence: 'high' | 'medium';
  };
  const pairs = new Map<string, PairData>();

  // Signal 1: exact name overlap (high confidence)
  for (const [name, ids] of nameToArtists) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]];
        if (memberPairs.has(`${a}|${b}`)) continue;
        const key = pairKey(a, b);
        const existing = pairs.get(key);
        if (existing) {
          existing.shared_names.push(name);
        } else {
          pairs.set(key, { a, b, reason: 'name_overlap', shared_names: [name], shared_songs: [], confidence: 'high' });
        }
      }
    }
  }

  // Signal 2: both linked to same song (medium confidence)
  for (const [songId, artistIds] of songToArtists) {
    if (artistIds.length < 2) continue;
    for (let i = 0; i < artistIds.length; i++) {
      for (let j = i + 1; j < artistIds.length; j++) {
        const [a, b] = [artistIds[i], artistIds[j]];
        if (memberPairs.has(`${a}|${b}`)) continue;
        const key = pairKey(a, b);
        const existing = pairs.get(key);
        if (existing) {
          existing.shared_songs.push(songId);
        } else {
          pairs.set(key, { a, b, reason: 'shared_song', shared_names: [], shared_songs: [songId], confidence: 'medium' });
        }
      }
    }
  }

  // Scoring: prefer artist with more songs + more filled fields
  function score(id: string): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = artistMap.get(id) as any;
    if (!a) return 0;
    return (artistSongCount.get(id) ?? 0) * 10
      + (a.bio_en       ? 3 : 0)
      + (a.bio_zh       ? 2 : 0)
      + (a.youtube_channel  ? 1 : 0)
      + (a.wikipedia_url    ? 1 : 0)
      + ((a.ethnic_groups ?? []).length > 0 ? 1 : 0)
      + (a.language     ? 1 : 0)
      + (a.active_years ? 1 : 0);
  }

  const result = [...pairs.values()]
    .map(({ a, b, reason, shared_names, shared_songs, confidence }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawA = artistMap.get(a) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawB = artistMap.get(b) as any;
      if (!rawA || !rawB) return null;

      const suggested_keep = score(a) >= score(b) ? a : b;

      const buildMini = (id: string, raw: typeof rawA) => {
        const names = namesByArtist.get(id) ?? [];
        return {
          id,
          name_display:  raw.name_display,
          names_zh:      names.filter(n => n.script === 'zh').map(n => n.name),
          names_en:      names.filter(n => n.script === 'en').map(n => n.name),
          names_ab:      names.filter(n => n.script === 'ab').map(n => n.name),
          ethnic_groups: raw.ethnic_groups ?? [],
          language:      raw.language ?? null,
          is_group:      raw.is_group ?? false,
          photo_url:     raw.photo_url ?? null,
          song_count:    artistSongCount.get(id) ?? 0,
          songs:         (artistSongs.get(id) ?? []).map(sid => ({ id: sid, title: songTitleMap.get(sid) ?? sid })),
        };
      };

      return {
        artist_a:      buildMini(a, rawA),
        artist_b:      buildMini(b, rawB),
        reason,
        confidence,
        suggested_keep,
        shared_names,
        shared_songs: shared_songs.map(id => ({ id, title: songTitleMap.get(id) ?? id })),
      };
    })
    .filter(Boolean)
    .sort((x, y) => {
      if (!x || !y) return 0;
      if (x.confidence === y.confidence) return 0;
      return x.confidence === 'high' ? -1 : 1;
    });

  return NextResponse.json(result);
}
