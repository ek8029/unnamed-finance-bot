import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog | Helm Terminal',
  description:
    'Financial intelligence insights, market analysis, and product updates from Helm Terminal.',
  openGraph: {
    title: 'Blog | Helm Terminal',
    description:
      'Financial intelligence insights, market analysis, and product updates from Helm Terminal.',
    url: 'https://helmterminal.dev/blog',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/blog' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* ── Navigation ── */}
      <nav className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <HelmMark size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
                Helm
              </div>
              <div className="type-eyebrow text-[var(--color-text-muted)]">
                Financial Intelligence
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Free Stock Analysis
            </Link>
            <Link
              href="/blog"
              className="text-sm text-[var(--color-gold)] transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/login"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <section className="container mx-auto px-6 pt-12 pb-8 max-w-4xl">
        <h1 className="font-sans font-bold text-[32px] md:text-[40px] text-[var(--color-text-primary)] tracking-tight mb-3">
          Blog
        </h1>
        <p className="text-[16px] text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
          Financial intelligence insights, market analysis, and product updates.
        </p>
      </section>

      {/* ── Post Grid ── */}
      <section className="container mx-auto px-6 pb-24 max-w-4xl">
        {posts.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-[15px]">
            No posts yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)] rounded-sm p-6 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="type-eyebrow text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] px-2 py-0.5 rounded-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="font-sans font-semibold text-[18px] text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-gold)] transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-4 line-clamp-3">
                  {post.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[12px] text-[var(--color-text-muted)] font-mono">
                    <span>{formatDate(post.date)}</span>
                    <span>&middot;</span>
                    <span>{post.readingTime}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <LegalFooter />
    </main>
  );
}
