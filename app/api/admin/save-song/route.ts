import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Song } from '@/lib/types';

const SONGS_PATH = path.join(process.cwd(), 'data/songs.json');
const ARTISTS_PATH = path.join(process.cwd(), 'data/artists.json');

// Inline alias resolution (mirrors link-artists.js logic)
function buildAliasMap(artists: { id: string; name_display: string; names_zh: string[]; names_rom: string[]; names_indigenous: string[] }[]) {
  const map = new Map<string, string>();
  for (const a of artists) {
    const aliases = [a.name_display, ...a.names_zh, ...a.names_rom, ...a.names_indigenous].filter(Boolean);
    for (const alias of aliases) map.set(alias.toLowerCase().trim(), a.id);
  }
  return map;
}

function resolveArtistId(artistStr: string, aliasMap: Map<string, string>): string | null {
  if (!artistStr || artistStr === 'Unknown / Traditional') return null;
  const lower = artistStr.toLowerCase().trim();
  let id = aliasMap.get(lower);
  if (id) return id;
  const noFeat = artistStr.replace(/\s*feat\..*$/i, '').trim();
  id = aliasMap.get(noFeat.toLowerCase());
  if (id) return id;
  const tokens = lower.replace(/[()]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  for (const t of tokens) { id = aliasMap.get(t); if (id) return id; }
  for (const [alias, aid] of aliasMap) {
    if (alias.length > 2 && lower.includes(alias)) return aid;
  }
  return null;
}

export async function POST(request: Request) {
  let song: Partial<Song> & Record<string, unknown>;
  try {
    song = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!song.id || !song.youtube_url) {
    return NextResponse.json({ error: 'Song must have id and youtube_url' }, { status: 400 });
  }

  try {
    // Read current songs
    const songsRaw = await fs.readFile(SONGS_PATH, 'utf8');
    const songs: Song[] = JSON.parse(songsRaw);

    // Check for duplicate
    if (songs.find(s => s.id === song.id || s.youtube_url === song.youtube_url)) {
      return NextResponse.json({ error: 'Duplicate song ID or YouTube URL' }, { status: 409 });
    }

    // Resolve artist_ids
    const artistsRaw = await fs.readFile(ARTISTS_PATH, 'utf8');
    const artists = JSON.parse(artistsRaw);
    const aliasMap = buildAliasMap(artists);
    const artistId = song.artist ? resolveArtistId(song.artist as string, aliasMap) : null;
    song.artist_ids = artistId ? [artistId] : [];

    // Ensure required fields
    song.tags = (song.tags as string[]) ?? [];
    song.confidence = ((song.confidence as string) ?? 'low') as 'low';
    song.verification_status = ((song.verification_status as string) ?? 'candidate') as 'candidate';
    song.needs_manual_verification = true;
    song.checked_by_me = false;
    song.date_added = new Date().toISOString().split('T')[0];

    // Remove internal draft fields
    delete song._oembed;

    // Append and write back
    songs.push(song as Song);
    await fs.writeFile(SONGS_PATH, JSON.stringify(songs, null, 2), 'utf8');

    // Write to unlinked queue if artist not resolved
    if (song.artist && !artistId) {
      const unlinkedPath = path.join(process.cwd(), 'data/artists_unlinked.json');
      let unlinked: { song_artist_string: string; suggested_action: string }[] = [];
      try {
        unlinked = JSON.parse(await fs.readFile(unlinkedPath, 'utf8'));
      } catch { /* file may not exist */ }
      if (!unlinked.find(u => u.song_artist_string === song.artist)) {
        unlinked.push({ song_artist_string: song.artist as string, suggested_action: 'add to artists.json or manually set artist_ids on songs' });
        await fs.writeFile(unlinkedPath, JSON.stringify(unlinked, null, 2), 'utf8');
      }
    }

    return NextResponse.json({ saved: song, artist_linked: !!artistId });
  } catch (err) {
    console.error('[save-song]', err);
    return NextResponse.json({ error: 'Failed to save song' }, { status: 500 });
  }
}
