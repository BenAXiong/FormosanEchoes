import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => {
          cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  await supabase.auth.signOut();

  // Explicitly delete all Supabase auth cookies — signOut() may not call setAll server-side
  request.cookies.getAll()
    .filter(c => c.name.startsWith('sb-'))
    .forEach(({ name }) => response.cookies.set(name, '', { maxAge: 0, path: '/' }));

  return response;
}
