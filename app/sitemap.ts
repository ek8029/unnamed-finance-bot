import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://helmterminal.dev';

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analyze`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/security`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/data-deletion`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ];
}
