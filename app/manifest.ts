import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Formosan Echoes',
    short_name: 'Formosan Echoes',
    description: 'A cultural metadata browser for Formosan-language songs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0f',
    theme_color: '#0a0a0f',
    icons: [
      {
        src: '/FE_logo_1c.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/FE_logo_1c.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}
