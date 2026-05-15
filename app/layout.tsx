import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export const metadata: Metadata = {
  title: 'Formosan Echoes — Formosan-Language Song Metadata Browser',
  description:
    'A cultural metadata browser for Formosan-language songs. Search and explore songs from Indigenous Taiwanese peoples, with evidence, verification status, and source links.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Formosan Echoes',
  },
};

import { PlayerProvider } from '@/lib/PlayerContext';
import PlayerBar from '@/components/PlayerBar';
import GlobalPlayer from '@/components/GlobalPlayer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={geist.variable}>
      <body className="antialiased bg-stone-50 text-stone-800" suppressHydrationWarning>
        <PlayerProvider>
          {children}
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
