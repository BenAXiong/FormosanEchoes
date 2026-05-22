'use client';

import { useState, useEffect } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createAuthBrowserClient } from '@/lib/supabase';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = createAuthBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then((result: { data: { user: User | null } }) =>
      setUser(result.data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_: AuthChangeEvent, session: Session | null) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const name = user?.user_metadata?.full_name as string | undefined;
  const initial = (name ?? user?.email ?? 'U')[0].toUpperCase();

  if (!user) {
    return (
      <button
        onClick={signIn}
        aria-label="Sign in with Google"
        title="Sign in"
        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
      >
        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Account"
        className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-2 ring-emerald-500/40 hover:ring-emerald-500/70 transition-all"
      >
        {avatar
          ? <img src={avatar} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white">{initial}</div>
        }
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" onClick={() => setOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-3 py-3 border-b border-white/5">
              {name && <p className="text-xs font-semibold text-white truncate">{name}</p>}
              <p className="text-[10px] text-stone-500 truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <button
                onClick={signOut}
                className="w-full text-left px-3 py-2 text-xs text-stone-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
