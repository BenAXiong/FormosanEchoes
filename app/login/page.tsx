import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase';

async function signInWithGoogle() {
  'use server';
  const supabase = await createAuthServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/admin`,
    },
  });
  if (error || !data.url) redirect('/login?error=oauth');
  redirect(data.url);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Already signed in → go straight to admin
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/admin');

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 px-8 py-10 rounded-2xl border border-white/8 bg-white/3">
        <img src="/FE_logo_1d.png" alt="Formosan Echoes" className="w-12 h-12 rounded-full object-cover" />
        <div className="text-center">
          <p className="text-white font-bold text-base tracking-tight">Formosan Echoes</p>
          <p className="text-stone-500 text-xs mt-0.5">Admin access</p>
        </div>

        {error === 'unauthorized' && (
          <p className="text-red-400 text-xs text-center max-w-[220px]">
            That Google account is not authorised for admin access.
          </p>
        )}
        {error === 'oauth' && (
          <p className="text-red-400 text-xs text-center">Sign-in failed. Try again.</p>
        )}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="flex items-center gap-3 px-5 py-2.5 bg-white text-stone-800 rounded-lg font-semibold text-sm hover:bg-stone-100 active:scale-95 transition-all"
          >
            {/* Google 'G' logo */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
