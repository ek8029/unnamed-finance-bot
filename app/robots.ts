import type { MetadataRoute } from 'next';

// Private routes that no crawler (including AI) should index
const DISALLOW = ['/dashboard', '/api/', '/mfa-verify'];

// AI crawlers we explicitly allow so Helm gets cited by LLMs and AI search.
// Each entry gets its own rule block so the allow is unambiguous even
// though the default '*' rule already permits them. Explicit > implicit
// for LLM crawlers, many of which only honor rules addressed by name.
const AI_CRAWLERS = [
  // OpenAI
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  // Anthropic
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google AI training
  'Google-Extended',
  // Apple
  'Applebot-Extended',
  // Common Crawl (used by many LLM training pipelines)
  'CCBot',
  // Others
  'DuckAssistBot',
  'Amazonbot',
  'Meta-ExternalAgent',
  'Bytespider',
  'cohere-ai',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://helmterminal.dev/sitemap.xml',
  };
}
