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

const LANG_TO_DIALECTS: Record<string, string> = {
  'Amis': '南勢阿美語,秀姑巒阿美語,海岸阿美語,馬蘭阿美語,恆春阿美語',
  'Atayal': '賽考利克泰雅語,澤敖利泰雅語,汶水泰雅語,萬大泰雅語,四季泰雅語,宜蘭澤敖利泰雅語,賽考利克太魯閣語,斯卡羅泰雅語',
  'Paiwan': '南排灣語,中排灣語,北排灣語,東排灣語',
  'Bunun': '卓群布農語,卡群布農語,丹群布農語,巒群布農語,郡群布農語',
  'Puyuma': '南王卑南語,知本卑南語,西群卑南語,建和卑南語',
  'Rukai': '霧台魯凱語,茂林魯凱語,多納魯凱語,東魯凱語,萬山魯凱語,大武魯凱語',
  'Tsou': '鄒語',
  'Saisiyat': '賽夏語',
  'Tao (Yami)': '雅美語',
  'Tao': '雅美語',
  'Yami': '雅美語',
  'Thao': '邵語',
  'Kavalan': '噶瑪蘭語',
  'Truku': '太魯閣語',
  'Sakizaya': '撒奇萊雅語',
  'Seediq': '德固達雅賽德克語,都達賽德克語,德鹿谷賽德克語',
  "Hla'alua": '拉阿魯哇語',
  'Kanakanavu': '卡那卡那富語'
};

export default function HoverableWord({ word, language }: { word: string; language?: string | null }) {
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
        let url = `/api/dict?q=${encodeURIComponent(clean)}`;
        if (language && LANG_TO_DIALECTS[language]) {
          url += `&dialects=${encodeURIComponent(LANG_TO_DIALECTS[language])}`;
        }
        const res = await fetch(url);
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
            <span className="text-[9px] text-stone-600 uppercase tracking-wider">{language || 'All'} dict</span>
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
