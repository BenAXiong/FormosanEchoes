import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Songs of Formosa — Formosan-Language Song Metadata Browser',
  description:
    'A cultural metadata browser for Formosan-language songs. Search and explore songs from Indigenous Taiwanese peoples, with evidence, verification status, and source links.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={geist.variable}>
      <body className="antialiased bg-stone-50 text-stone-800" suppressHydrationWarning>{children}</body>
    </html>
  );
}
