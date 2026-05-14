'use client';
import { useState, useRef, useCallback } from 'react';

interface DictEntry {
  ab: string;
  zh: string;
  dialect_name: string;
}

function cleanWord(w: string): string {
  return w.replace(/^[,.'";:!?()\[\]{}—–]+|[,.'";:!?()\[\]{}—–]+$/g, '').toLowerCase();
}

interface TooltipPos {
  top?: number;    // fixed from viewport top (below placement)
  bottom?: number; // fixed from viewport bottom (above placement)
  left: number;
}

export default function HoverableWord({ word }: { word: string }) {
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetched = useRef(false);

  const clean = cleanWord(word);
  const lookupable = clean.length >= 2;

  const handleEnter = useCallback(async () => {
    if (!lookupable) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);

    // Compute fixed position from bounding rect — avoids any overflow/clip context
    if (wordRef.current) {
      const rect = wordRef.current.getBoundingClientRect();
      // Clamp left so tooltip doesn't overflow viewport right edge
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 252));
      // Flip: show below if word is in top 220px of viewport (toolbar area), else above
      if (rect.top < 220) {
        setPos({ top: rect.bottom + 6, left });
      } else {
        setPos({ bottom: window.innerHeight - rect.top + 6, left });
      }
    }

    setShow(true);
    if (fetched.current) return;

    fetchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dict?q=${encodeURIComponent(clean)}`);
        const data = await res.json();
        setEntries(data.results ?? []);
        fetched.current = true;
      } catch {
        setEntries([]);
      }
      setLoading(false);
    }, 350);
  }, [clean, lookupable]);

  const handleLeave = useCallback(() => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    hideTimer.current = setTimeout(() => setShow(false), 220);
  }, []);

  const keepOpen = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <span className="relative inline">
      <span
        ref={wordRef}
        onMouseEnter={lookupable ? handleEnter : undefined}
        onMouseLeave={lookupable ? handleLeave : undefined}
        className={lookupable
          ? 'cursor-help hover:text-emerald-300 transition-colors duration-100'
          : undefined}
      >{word}</span>
      {' '}

      {show && pos && lookupable && (
        <span
          onMouseEnter={keepOpen}
          onMouseLeave={handleLeave}
          className="fixed z-[9999] w-60 rounded-xl bg-[#16162a] border border-white/15 shadow-2xl text-xs pointer-events-auto"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
        >
          {/* Header */}
          <span className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-stone-200 font-semibold font-mono">{clean}</span>
            <span className="text-[9px] text-stone-600 uppercase tracking-wider">Amis dict</span>
          </span>

          {/* Body */}
          {loading ? (
            <span className="block px-3 py-2.5 text-stone-500 italic">Looking up…</span>
          ) : !entries || entries.length === 0 ? (
            <span className="block px-3 py-2.5 text-stone-600 italic">Not found</span>
          ) : (
            <span className="block max-h-44 overflow-y-auto demo-sidebar divide-y divide-white/5">
              {entries.slice(0, 6).map((e, i) => (
                <span key={i} className="flex items-baseline gap-2 px-3 py-1.5 block">
                  <span className="text-emerald-300 font-medium shrink-0">{e.zh}</span>
                  <span className="text-stone-500 text-[10px] truncate">{e.dialect_name}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
