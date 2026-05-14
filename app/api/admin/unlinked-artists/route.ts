import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const UNLINKED_PATH = path.join(process.cwd(), 'data/artists_unlinked.json');

export async function GET() {
  try {
    const raw = await fs.readFile(UNLINKED_PATH, 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json([]);
  }
}
