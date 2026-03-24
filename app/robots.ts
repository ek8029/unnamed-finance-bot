import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      // Explicitly allow AI search crawlers so Helm gets cited in AI answers
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/dashboard', '/api/', '/mfa-verify'],
      },
    ],
    sitemap: 'https://helmterminal.dev/sitemap.xml',
  };
}
