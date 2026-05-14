'use client';
import { useState } from 'react';
import type { FilterState } from '@/lib/types';
import { DEFAULT_FILTERS, hasActiveFilters } from '@/lib/filters';

const CIP_LANGUAGES = [
  { value: 'Amis', label: 'Amis 阿美族語' },
  { value: 'Atayal', label: 'Atayal 泰雅族語' },
  { value: 'Paiwan', label: 'Paiwan 排灣族語' },
  { value: 'Bunun', label: 'Bunun 布農族語' },
  { value: 'Puyuma', label: 'Puyuma 卑南族語' },
  { value: 'Rukai', label: 'Rukai 魯凱族語' },
  { value: 'Tsou', label: 'Tsou 鄒族語' },
  { value: 'Saisiyat', label: 'Saisiyat 賽夏族語' },
  { value: 'Tao (Yami)', label: 'Tao 達悟族語' },
  { value: 'Thao', label: 'Thao 邵族語' },
  { value: 'Kavalan', label: 'Kavalan 噶瑪蘭族語' },
  { value: 'Truku', label: 'Truku 太魯閣族語' },
  { value: 'Sakizaya', label: 'Sakizaya 撒奇萊雅族語' },
  { value: 'Seediq', label: 'Seediq 賽德克族語' },
  { value: "Hla'alua", label: "Hla'alua 拉阿魯哇族語" },
  { value: 'Kanakanavu', label: 'Kanakanavu 卡那卡那富族語' },
];

const CIP_PEOPLES = [
  { value: 'Amis (Pangcah)', label: 'Amis 阿美族' },
  { value: 'Atayal', label: 'Atayal 泰雅族' },
  { value: 'Paiwan', label: 'Paiwan 排灣族' },
  { value: 'Bunun', label: 'Bunun 布農族' },
  { value: 'Puyuma', label: 'Puyuma 卑南族' },
  { value: 'Rukai', label: 'Rukai 魯凱族' },
  { value: 'Tsou', label: 'Tsou 鄒族' },
  { value: 'Saisiyat', label: 'Saisiyat 賽夏族' },
  { value: 'Tao (Yami)', label: 'Tao 達悟族' },
  { value: 'Thao', label: 'Thao 邵族' },
  { value: 'Kavalan', label: 'Kavalan 噶瑪蘭族' },
  { value: 'Truku', label: 'Truku 太魯閣族' },
  { value: 'Sakizaya', label: 'Sakizaya 撒奇萊雅族' },
  { value: 'Seediq', label: 'Seediq 賽德克族' },
  { value: "Hla'alua", label: "Hla'alua 拉阿魯哇族" },
  { value: 'Kanakanavu', label: 'Kanakanavu 卡那卡那富族' },
];

const FIRST_N = 6;

function PillList({
  options, value, onChange, expandLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  expandLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, FIRST_N);
  const rest = options.length - FIRST_N;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => onChange('')}
        className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors
          ${!value ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
      >All</button>
      {visible.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? '' : o.value)}
          className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors truncate
            ${value === o.value ? 'bg-white/10 text-white font-semibold' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
        >{o.label}</button>
      ))}
      {rest > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-left px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:text-stone-400 hover:bg-white/5 transition-colors"
        >{expanded ? '↑ Show less' : `+ ${rest} ${expandLabel}`}</button>
      )}
    </div>
  );
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  totalCount: number;
}

export default function DemoFilterSidebar({ filters, onChange, resultCount, totalCount }: Props) {
  const set = (key: keyof FilterState, value: string | boolean | null) =>
    onChange({ ...filters, [key]: value });
  const active = hasActiveFilters(filters);

  return (
    <aside className="h-full flex flex-col bg-[#0f0f16] overflow-hidden">
      {/* Title */}
      <div className="px-4 py-4 border-b border-white/5 shrink-0">
        <p className="text-white font-bold text-sm tracking-tight">Songs of Formosa</p>
        <p className="text-stone-500 text-[10px] mt-0.5">台灣原住民音樂索引</p>
      </div>

      {/* Count + clear */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <p className="text-stone-500 text-xs tabular-nums">
          <span className="text-white font-semibold">{resultCount}</span>
          <span className="text-stone-600"> / {totalCount}</span>
        </p>
        {active && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-stone-500 hover:text-white transition-colors"
          >Clear filters</button>
        )}
      </div>

      {/* Filter lists */}
      <div className="flex-1 py-4 overflow-y-auto demo-sidebar">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-3">Language</p>
          <PillList
            options={CIP_LANGUAGES}
            value={filters.language}
            onChange={(v) => set('language', v)}
            expandLabel="other languages"
          />
        </div>
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2 px-3">People</p>
          <PillList
            options={CIP_PEOPLES}
            value={filters.ethnic_group}
            onChange={(v) => set('ethnic_group', v)}
            expandLabel="other peoples"
          />
        </div>
      </div>

      {/* User profile pill — bottom */}
      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">B</div>
          <div>
            <p className="text-white text-xs font-semibold leading-tight">Ben</p>
            <p className="text-stone-500 text-[10px]">Researcher</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
