import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '契咧！',
    short_name: '契咧！',
    description: 'A cultural metadata browser for Formosan-language songs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      {
        src: '/FE_logo_1d.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/FE_logo_1d.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
