import { NextResponse } from 'next/server';

async function probe(url: string, method: 'HEAD' | 'GET'): Promise<{ status: number; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      signal: controller.signal,
      // only read enough for GET to confirm content-type; don't download the whole file
      ...(method === 'GET' ? { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)', Range: 'bytes=0-0' } } : {}),
    });
    return { status: res.status, contentType: res.headers.get('content-type') ?? '' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ ok: false });

  try {
    let { status, contentType } = await probe(url, 'HEAD');

    // Some servers reject HEAD — fall back to a range GET
    if (status === 405 || status === 501) {
      ({ status, contentType } = await probe(url, 'GET'));
    }

    const ok = status >= 200 && status < 300 && contentType.startsWith('image/');
    return NextResponse.json({ ok, status });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
