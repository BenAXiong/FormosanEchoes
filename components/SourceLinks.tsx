interface SourceLinksProps {
  url?: string;
  youtube_url?: string;
  lyrics_url?: string;
  source_platform?: string;
}

export default function SourceLinks({ url, youtube_url, lyrics_url, source_platform }: SourceLinksProps) {
  const links = [
    youtube_url && { label: 'YouTube', href: youtube_url, icon: '▶' },
    lyrics_url && { label: 'Lyrics Source', href: lyrics_url, icon: '♪' },
    url && url !== youtube_url && { label: source_platform ?? 'Source', href: url, icon: '↗' },
  ].filter(Boolean) as { label: string; href: string; icon: string }[];

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
            bg-stone-100 text-stone-700 border border-stone-200
            hover:bg-formosa-teal hover:text-white hover:border-formosa-teal
            transition-colors duration-150"
        >
          <span aria-hidden="true">{link.icon}</span>
          {link.label}
        </a>
      ))}
    </div>
  );
}
