'use client';

import { useState, useEffect } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { createAuthBrowserClient } from '@/lib/supabase-browser';
import { usePlayer } from '@/lib/PlayerContext';

interface Props {
  readonly variant?: 'icon' | 'sidebar';
}

export default function UserProfile({ variant = 'icon' }: Props) {
  const { signOutAuth } = usePlayer();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Server read: bypasses browser-client initialization timing
    fetch('/api/me')
      .then(r => r.json())
      .then(({ user }: { user: User | null }) => setUser(user))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Subscribe for sign-in / sign-out events that happen while the page is open
    const supabase = createAuthBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    await createAuthBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  };

  const signOut = () => {
    setUser(null);
    setOpen(false);
    signOutAuth();
    window.location.assign('/api/sign-out'); // server clears cookies, redirects to /
  };

  if (loading) {
    return variant === 'sidebar'
      ? <div className="w-full h-10 rounded-xl bg-white/5 animate-pulse" />
      : <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse shrink-0" />;
  }

  const avatar = user?.user_metadata?.avatar_url as string | undefined;
  const name = user?.user_metadata?.full_name as string | undefined;
  const initial = (name ?? user?.email ?? 'U')[0].toUpperCase();

  if (!user) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={signIn}
          aria-label="Sign in with Google"
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-amber-400 leading-tight">Sign in</span>
          <span className="text-[10px] text-amber-500/60 leading-tight truncate">save favorites</span>
        </button>
      );
    }

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

  if (variant === 'sidebar') {
    return (
      <div className="relative w-full">
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Account"
          className="w-full flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 ring-2 ring-emerald-500/40">
            {avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">{initial}</div>
            }
          </div>
          <span className="text-xs text-stone-300 truncate">{name ?? user.email}</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1.5 w-56 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
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
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
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
