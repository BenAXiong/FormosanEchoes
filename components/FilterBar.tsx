'use client';

import type { FilterState } from '@/lib/types';
import type { ControlledVocab } from '@/lib/types';
import { DEFAULT_FILTERS, hasActiveFilters } from '@/lib/filters';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  vocab: ControlledVocab;
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[130px]">
      <label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700
          focus:border-formosa-teal focus:outline-none focus:ring-2 focus:ring-formosa-teal/20
          transition-colors duration-150 cursor-pointer"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function FilterBar({ filters, onChange, vocab }: FilterBarProps) {
  const set = (key: keyof FilterState, value: string | boolean | null) =>
    onChange({ ...filters, [key]: value });

  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        id="filter-language"
        label="Language"
        value={filters.language}
        options={vocab.languages}
        onChange={(v) => set('language', v)}
      />
      <Select
        id="filter-people-group"
        label="Ethnic Group"
        value={filters.ethnic_group}
        options={vocab.ethnic_groups}
        onChange={(v) => set('ethnic_group', v)}
      />
      <Select
        id="filter-tag"
        label="Tag"
        value={filters.tag}
        options={vocab.tags}
        onChange={(v) => set('tag', v)}
      />
      <Select
        id="filter-confidence"
        label="Confidence"
        value={filters.confidence}
        options={vocab.confidence_levels}
        onChange={(v) => set('confidence', v)}
      />
      <Select
        id="filter-status"
        label="Status"
        value={filters.verification_status}
        options={vocab.verification_statuses}
        onChange={(v) => set('verification_status', v)}
      />

      {/* Has lyrics toggle */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Lyrics</span>
        <div className="flex gap-1">
          {[
            { label: 'All', value: null },
            { label: 'Has lyrics', value: true },
            { label: 'No lyrics', value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => set('has_lyrics', opt.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150
                ${filters.has_lyrics === opt.value
                  ? 'bg-formosa-teal text-white border-formosa-teal'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-formosa-teal/50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="self-end px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500
            border border-stone-200 hover:bg-stone-100 hover:text-stone-700
            transition-colors duration-150"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
