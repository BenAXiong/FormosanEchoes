'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <label htmlFor="song-search" className="sr-only">
        Search songs by title, artist, language, people/group, tag, or notes
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4" aria-hidden="true">
        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        id="song-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by title, artist, language, tags…"
        className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-10 text-sm text-stone-800
          placeholder-stone-400 shadow-sm
          focus:border-formosa-teal focus:outline-none focus:ring-2 focus:ring-formosa-teal/20
          transition-colors duration-150"
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
