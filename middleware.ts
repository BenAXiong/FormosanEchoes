import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Build a mutable response so we can refresh session cookies
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => {
          cs.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the JWT server-side — cannot be spoofed by a crafted cookie
  const { data: { user } } = await supabase.auth.getUser();
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (!user) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Email allowlist — only listed addresses may access admin
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(user.email ?? '')) {
    await supabase.auth.signOut();
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
