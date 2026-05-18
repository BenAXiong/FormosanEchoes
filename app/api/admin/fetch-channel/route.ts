import { NextResponse } from 'next/server';

const API_KEY = process.env.YOUTUBE_API_KEY;

interface YTSnippet {
  resourceId?: { videoId?: string };
  title?: string;
  videoOwnerChannelTitle?: string;
}

async function resolveUploadsPlaylist(identifier: string): Promise<string | null> {
  // identifier is either a @handle (without @) or a UCxxxxxx channel ID
  const byHandle = !identifier.startsWith('UC');
  const params = new URLSearchParams({
    part: 'contentDetails', key: API_KEY!,
    ...(byHandle ? { forHandle: identifier } : { id: identifier }),
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, { cache: 'no-store' });
  const data = await res.json() as { items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[] };
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

async function paginatePlaylist(playlistId: string, cap = 500) {
  const items: Array<{ videoId: string; url: string; title: string; channel: string }> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet', playlistId, maxResults: '50', key: API_KEY!,
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { cache: 'no-store' },
    );
    const data = await res.json() as { items?: { snippet: YTSnippet }[]; nextPageToken?: string };
    if (!res.ok) break;

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) items.push({
        videoId,
        url:     `https://www.youtube.com/watch?v=${videoId}`,
        title:   item.snippet?.title                  ?? '',
        channel: item.snippet?.videoOwnerChannelTitle ?? '',
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < cap);

  return items;
}

export async function GET(request: Request) {
  if (!API_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 503 });

  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) return NextResponse.json({ error: 'Missing handle param' }, { status: 400 });

  try {
    const uploadsId = await resolveUploadsPlaylist(handle);
    if (!uploadsId) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    return NextResponse.json({ items: await paginatePlaylist(uploadsId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 502 });
  }
}
