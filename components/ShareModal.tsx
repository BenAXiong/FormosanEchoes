'use client';
import { useState } from 'react';
import { useT } from '@/lib/lang';

export interface ShareTarget {
  url: string;
  title: string;
  text?: string;
}

interface Props extends ShareTarget {
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'instagram';

export default function ShareModal({ url, title, text, onClose }: Props) {
  const t = useT();
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const copy = async (variant: CopyState = 'copied') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState(variant);
      setTimeout(() => setCopyState('idle'), variant === 'instagram' ? 3000 : 2000);
    } catch { /* ignore */ }
  };

  const enc = encodeURIComponent;
  const shareText = text
    ? `${title}\n\n${text}\n\n${url}`
    : `${title}\n${url}`;

  const LINKS = [
    {
      id: 'instagram',
      label: t('shareOnInstagram'),
      bg: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F56040]',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5" aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="5"/>
          <circle cx="12" cy="12" r="4.5"/>
          <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
      ),
      onClick: () => copy('instagram'),
    },
    {
      id: 'facebook',
      label: t('shareOnFacebook'),
      bg: 'bg-[#1877F2]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
          <path d="M13.5 21.95V14h2.7l.4-3H13.5v-1.9c0-.87.24-1.46 1.5-1.46H16.7V4.8A19.6 19.6 0 0 0 14.3 4.7c-2.4 0-4 1.47-4 4.17V11H7.6v3h2.7v7.95a9.05 9.05 0 0 0 3.2 0Z"/>
        </svg>
      ),
    },
    {
      id: 'whatsapp',
      label: t('shareOnWhatsApp'),
      bg: 'bg-[#25D366]',
      href: `https://wa.me/?text=${enc(shareText)}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96s-.47-.15-.67.15-.77.96-.94 1.15-.35.23-.64.08a8.07 8.07 0 0 1-2.38-1.47 8.92 8.92 0 0 1-1.64-2.05c-.17-.3 0-.46.13-.6s.3-.35.44-.52.15-.3.23-.5.04-.37-.02-.52-.67-1.6-.91-2.2c-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.38S7 7.8 7 9.05c0 1.26.92 2.48 1.05 2.65a13.6 13.6 0 0 0 5.34 4.75c.74.32 1.32.51 1.77.65a4.27 4.27 0 0 0 1.97.12c.6-.09 1.85-.76 2.11-1.49s.26-1.36.18-1.49-.27-.19-.57-.34Zm-5.44 7.44h-.01a9.98 9.98 0 0 1-5.07-1.38l-.36-.22-3.77 1 1.01-3.67-.24-.38A10 10 0 1 1 12.03 21.82Zm0-19.82A9.97 9.97 0 0 0 3.5 18.18L2 22l3.92-1.03A9.97 9.97 0 1 0 12.03 2Z"/>
        </svg>
      ),
    },
    {
      id: 'x',
      label: t('shareOnX'),
      bg: 'bg-[#000000]',
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
    },
    {
      id: 'email',
      label: t('shareViaEmail'),
      bg: 'bg-[#6B7280]',
      href: `mailto:?subject=${enc(title)}&body=${enc(text ? shareText : url)}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 7l10 7 10-7"/>
        </svg>
      ),
    },
    {
      id: 'reddit',
      label: t('shareOnReddit'),
      bg: 'bg-[#FF4500]',
      href: `https://reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
          <circle cx="12" cy="12" r="10"/>
          <path fill="white" d="M20 12a1.67 1.67 0 0 0-2.83-1.19 8.2 8.2 0 0 0-4.42-1.38l.75-3.53 2.44.52a1.17 1.17 0 1 0 .12-.56l-2.72-.58a.25.25 0 0 0-.3.19l-.84 3.94a8.21 8.21 0 0 0-4.44 1.4 1.67 1.67 0 1 0-1.86 2.72 3.27 3.27 0 0 0 0 .47c0 2.39 2.78 4.33 6.2 4.33s6.2-1.94 6.2-4.33a3.27 3.27 0 0 0 0-.47A1.67 1.67 0 0 0 20 12Zm-11.44 1c0-.55.44-1 .99-1s1 .45 1 1-.45 1-1 1a1 1 0 0 1-1-1Zm5.57 2.64a3.2 3.2 0 0 1-4.26 0 .25.25 0 0 1 .34-.36 2.72 2.72 0 0 0 3.58 0 .25.25 0 0 1 .34.36Zm-.2-1.64a1 1 0 1 1 1-1 1 1 0 0 1-1 1Z"/>
        </svg>
      ),
    },
  ] as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" aria-hidden />
      <div
        className="relative bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white">{t('shareModal')}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-stone-400 hover:text-white transition-colors text-sm"
          >✕</button>
        </div>

        {/* Social icon row */}
        <div className="flex justify-around mb-5">
          {LINKS.map(link => (
            <div key={link.id} className="flex flex-col items-center gap-1.5">
              {'href' in link ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className={`w-12 h-12 rounded-full ${link.bg} flex items-center justify-center text-white hover:opacity-90 transition-opacity`}
                >
                  {link.icon}
                </a>
              ) : (
                <button
                  onClick={link.onClick}
                  aria-label={link.label}
                  className={`w-12 h-12 rounded-full ${link.bg} flex items-center justify-center text-white hover:opacity-90 transition-opacity`}
                >
                  {link.icon}
                </button>
              )}
              <span className="text-[10px] text-stone-500 text-center w-14 leading-tight truncate">{link.label}</span>
            </div>
          ))}
        </div>

        {/* Instagram hint */}
        {copyState === 'instagram' && (
          <p className="text-[11px] text-amber-400 text-center mb-3 leading-snug">{t('instagramCopyHint')}</p>
        )}

        {/* URL bar + copy */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-stone-500 truncate font-mono">
            {url}
          </div>
          <button
            onClick={() => copy('copied')}
            className="shrink-0 px-3 py-2 rounded-lg bg-white/8 border border-white/10 text-xs font-semibold text-stone-300 hover:text-white hover:bg-white/15 transition-colors"
          >
            {copyState === 'copied' ? t('copied') : t('copyLink')}
          </button>
        </div>
      </div>
    </div>
  );
}
