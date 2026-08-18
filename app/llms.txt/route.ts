import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAllPosts } from '@/lib/blog';

const SITE = 'https://helmterminal.dev';

/**
 * llms.txt is the file built to be quoted by machines, so a stale one is worse
 * than a short one. The Educational Content section used to be a hand-written
 * list in public/llms.txt: it claimed 39 articles when there were 55, listed
 * ten of them, and named none of the posts added since it was last touched.
 *
 * Everything else in that file is genuinely static and stays there. Only the
 * blog section is regenerated here, from the same getAllPosts() the blog index
 * and sitemap use, so the count and the list cannot drift again.
 */
function blogSection(): string {
  const posts = getAllPosts().filter((p) => p.published);

  const lines = posts.map(
    (p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.description}`,
  );

  return [
    `## Educational Content (${posts.length} articles)`,
    ...lines,
    `- Browse all articles at ${SITE}/blog`,
  ].join('\n');
}

export async function GET() {
  const raw = readFileSync(join(process.cwd(), 'public', 'llms.txt'), 'utf-8');

  // Replace from the Educational Content heading up to the next top-level
  // heading, leaving the surrounding sections untouched.
  const content = raw.replace(
    /## Educational Content[\s\S]*?(?=\n## )/,
    blogSection() + '\n',
  );

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
