import { NextResponse } from 'next/server';

/**
 * GET /api/admin/fetch-song?url=<youtube_url>
 * Fetches YouTube oEmbed metadata and returns a draft Song object.
 * No API key required — uses the public YouTube oEmbed endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') ?? '';

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  // Extract YouTube video ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (!ytMatch) {
    return NextResponse.json({ error: 'Not a recognised YouTube URL' }, { status: 400 });
  }
  const videoId = ytMatch[1];

  try {
    // YouTube oEmbed — free, no API key
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('oEmbed failed');
    const oembed = await res.json();

    const title: string = oembed.title ?? '';
    const channel: string = oembed.author_name ?? '';

    // Heuristic: split "Title - Artist" or "Artist - Title" patterns
    const dashParts = title.split(/\s*[-–—]\s*/);
    const guessedArtist = dashParts.length > 1 ? dashParts[dashParts.length - 1] : channel;
    const guessedTitle = dashParts.length > 1 ? dashParts.slice(0, -1).join(' - ') : title;

    const draft = {
      id: `song-${Date.now()}`,
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      title_original: guessedTitle,
      title_romanized: null,
      title_chinese: null,
      artist: guessedArtist,
      language_claimed: null,
      ethnic_group_claimed: null,
      genre: null,
      year: null,
      album_or_source: channel,
      tags: [],
      confidence: 'low',
      verification_status: 'candidate',
      needs_manual_verification: true,
      checked_by_me: false,
      lyrics: null,
      // metadata from oEmbed
      _oembed: { title, channel, videoId },
    };

    return NextResponse.json({ draft });
  } catch (err) {
    console.error('[fetch-song]', err);
    return NextResponse.json({ error: 'Failed to fetch YouTube metadata' }, { status: 500 });
  }
}
