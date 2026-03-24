import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Share2 } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { getAllPosts, getPostBySlug, extractHeadings } from '@/lib/blog';
import { mdxComponents, CTACard, ComparisonTable, ProTip } from '@/components/blog/mdx-components';
import { TableOfContents } from './table-of-contents';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post Not Found | Helm Terminal' };

  return {
    title: `${post.title} | Helm Terminal`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://helmterminal.dev/blog/${slug}`,
      siteName: 'Helm Terminal',
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      ...(post.image && {
        images: [{ url: post.image, width: 1200, height: 630, alt: post.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      ...(post.image && { images: [post.image] }),
    },
    alternates: { canonical: `https://helmterminal.dev/blog/${slug}` },
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-[24px] font-bold text-[var(--color-text-primary)] mb-3">
            Post not found
          </h1>
          <Link href="/blog" className="text-[var(--color-gold)] hover:underline text-[15px]">
            Back to all posts
          </Link>
        </div>
      </main>
    );
  }

  const headings = extractHeadings(post.content);
  const shareText = encodeURIComponent(`${post.title} — by @helmterminal\n\nhttps://helmterminal.dev/blog/${slug}`);
  const shareUrl = `https://x.com/intent/tweet?text=${shareText}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: { '@type': 'Organization', name: post.author },
      publisher: {
        '@type': 'Organization',
        name: 'Helm Terminal',
        url: 'https://helmterminal.dev',
      },
      url: `https://helmterminal.dev/blog/${slug}`,
      ...(post.image && {
        image: `https://helmterminal.dev${post.image}`,
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://helmterminal.dev/blog' },
        { '@type': 'ListItem', position: 3, name: post.title, item: `https://helmterminal.dev/blog/${slug}` },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Navigation ── */}
      <nav className="container mx-auto px-6 py-3 glass-nav">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <HelmMark size={32} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</span>
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

      {/* ── Article Layout ── */}
      <div className="container mx-auto px-6 pt-8 pb-24">
        <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[1fr_220px] lg:gap-12">
          {/* ── Article ── */}
          <article className="max-w-3xl glass-panel rounded-lg p-6 md:p-8">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All posts
            </Link>

            {/* Header */}
            <header className="mb-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="type-eyebrow text-[var(--color-gold)] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] px-2 py-0.5 rounded-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className="font-sans font-bold text-[32px] md:text-[40px] text-[var(--color-text-primary)] tracking-tight leading-[1.1] mb-4">
                {post.title}
              </h1>
              <div className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)] font-mono">
                <span>{post.author}</span>
                <span>&middot;</span>
                <span>{formatDate(post.date)}</span>
                <span>&middot;</span>
                <span>{post.readingTime}</span>
              </div>
            </header>

            {/* MDX Content */}
            <div className="blog-content">
              <MDXRemote
                source={post.content}
                components={mdxComponents}
                options={{
                  scope: {},
                }}
              />
            </div>

            {/* ── Post Footer ── */}
            <footer className="mt-16 space-y-6">
              {/* Share + Back */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border-base)]">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-1.5 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to all posts
                </Link>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share on X
                </a>
              </div>
            </footer>
          </article>

          {/* ── Table of Contents (desktop) ── */}
          {headings.length > 0 && (
            <aside className="hidden lg:block">
              <TableOfContents headings={headings} />
            </aside>
          )}
        </div>
      </div>

      <LegalFooter />
    </main>
  );
}
