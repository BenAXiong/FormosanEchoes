import { NextResponse } from 'next/server';

const PORTAL_URL = process.env.PORTAL_URL ?? 'https://ycm-citadel.vercel.app';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const dialects = searchParams.get('dialects') ?? '';
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    let url = `${PORTAL_URL}/api/search?mode=DICT&q=${encodeURIComponent(q)}`;
    if (dialects) url += `&dialects=${encodeURIComponent(dialects)}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();
    return NextResponse.json({ results: data.results ?? [] });
  } catch {
    // Portal offline — return empty gracefully
    return NextResponse.json({ results: [], offline: true });
  }
}
