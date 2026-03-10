import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
    ],
    sitemap: 'https://helmterminal.dev/sitemap.xml',
  };
}
