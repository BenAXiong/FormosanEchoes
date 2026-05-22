import { createBrowserClient } from '@supabase/ssr';

let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createAuthBrowserClient() {
  if (!_browserClient) {
    _browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browserClient;
}
