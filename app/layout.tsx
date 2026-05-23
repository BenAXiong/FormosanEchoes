import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export const metadata: Metadata = {
  title: "Chill'ey ~",
  description:
    'A cultural metadata browser for Formosan-language songs. Search and explore songs from Indigenous Taiwanese peoples, with evidence, verification status, and source links.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Chill'ey ~",
  },
};

import { PlayerProvider } from '@/lib/PlayerContext';
import { LangProvider } from '@/lib/lang';
import PlayerBar from '@/components/PlayerBar';
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={geist.variable}>
      <body className="antialiased bg-stone-50 text-stone-800" suppressHydrationWarning>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        <LangProvider>
          <PlayerProvider>
            {children}
            <PlayerBar />
          </PlayerProvider>
        </LangProvider>
      </body>
    </html>
  );
}
