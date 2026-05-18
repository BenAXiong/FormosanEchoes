import { NextResponse } from 'next/server';

const API_KEY = process.env.YOUTUBE_API_KEY;

interface YTSnippet {
  resourceId?: { videoId?: string };
  title?: string;
  videoOwnerChannelTitle?: string;
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
    const data = await res.json() as { items?: { snippet: YTSnippet }[]; nextPageToken?: string; error?: { message: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `YouTube API ${res.status}`);

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (videoId) items.push({
        videoId,
        url:     `https://www.youtube.com/watch?v=${videoId}`,
        title:   item.snippet?.title                   ?? '',
        channel: item.snippet?.videoOwnerChannelTitle  ?? '',
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && items.length < cap);

  return items;
}

export async function GET(request: Request) {
  if (!API_KEY) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 503 });

  const listId = new URL(request.url).searchParams.get('list');
  if (!listId) return NextResponse.json({ error: 'Missing list param' }, { status: 400 });

  try {
    return NextResponse.json({ items: await paginatePlaylist(listId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 502 });
  }
}
