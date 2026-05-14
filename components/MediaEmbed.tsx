import { isYouTubeUrl, getYouTubeId } from '@/lib/normalize';

interface MediaEmbedProps {
  youtube_url?: string;
  url?: string;
  source_platform?: string;
  title: string;
}

export default function MediaEmbed({ youtube_url, url, source_platform, title }: MediaEmbedProps) {
  // Try YouTube embed first
  if (youtube_url && isYouTubeUrl(youtube_url)) {
    const videoId = getYouTubeId(youtube_url);
    if (videoId) {
      return (
        <div className="w-full aspect-video rounded-xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100">
          <iframe
            title={`${title} — YouTube`}
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
          />
        </div>
      );
    }
  }

  // Fallback: open source button
  const href = youtube_url ?? url;
  if (href) {
    return (
      <div className="w-full aspect-video rounded-xl border border-stone-200 bg-stone-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 text-xl" aria-hidden="true">
          ▶
        </div>
        <p className="text-sm text-stone-600 text-center px-4">{title}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-formosa-teal text-white text-sm font-medium
            hover:bg-formosa-teal/90 transition-colors duration-150"
        >
          Open on {source_platform ?? 'Source'}
        </a>
      </div>
    );
  }

  // No media at all
  return (
    <div className="w-full aspect-video rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center">
      <p className="text-sm text-stone-400">No media link available</p>
    </div>
  );
}
