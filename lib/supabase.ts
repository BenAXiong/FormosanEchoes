import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServer } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ── Service role client ────────────────────────────────────────────────────────
// Server-only. Used by all admin API routes for DB writes. Never import in client components.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ── Auth server client ─────────────────────────────────────────────────────────
// Used in server components and route handlers to read/validate the user session.
// Uses anon key + cookies — never has elevated DB privileges.
export async function createAuthServerClient() {
  const cookieStore = await cookies();
  return createSSRServer(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    }
  );
}
