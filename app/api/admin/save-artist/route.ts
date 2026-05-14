import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ARTISTS_PATH = path.join(process.cwd(), 'data/artists.json');

export async function POST(request: Request) {
  let artist: Record<string, any>;
  try {
    artist = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const raw = await fs.readFile(ARTISTS_PATH, 'utf8');
    const artists = JSON.parse(raw);

    // Generate ID if missing
    if (!artist.id) {
      const lastId = artists.length > 0
        ? Math.max(...artists.map((a: any) => parseInt(a.id.split('-')[1]) || 0))
        : 0;
      artist.id = `art-${(lastId + 1).toString().padStart(3, '0')}`;
    }

    // Check for duplicate ID
    if (artists.find((a: any) => a.id === artist.id)) {
      return NextResponse.json({ error: 'Duplicate artist ID' }, { status: 409 });
    }

    // Append and write
    artists.push(artist);
    await fs.writeFile(ARTISTS_PATH, JSON.stringify(artists, null, 2), 'utf8');

    // Run the linker script to update songs.json
    try {
      await execAsync('node scripts/link-artists.js');
    } catch (linkErr) {
      console.error('[save-artist] Linker failed:', linkErr);
      // Not fatal to the save, but good to know
    }

    return NextResponse.json({ saved: artist });
  } catch (err) {
    console.error('[save-artist]', err);
    return NextResponse.json({ error: 'Failed to save artist' }, { status: 500 });
  }
}
