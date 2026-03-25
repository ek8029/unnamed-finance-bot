import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { MDXComponents } from 'mdx/types';

/* ── Anchor link icon ── */
function AnchorIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-block ml-2 w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity text-[var(--color-text-muted)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* ── Custom MDX components ── */

function H1({ children }: { children?: React.ReactNode }) {
  const id = slugify(String(children ?? ''));
  return (
    <h1 id={id} className="group font-sans font-bold text-[28px] md:text-[32px] text-[var(--color-text-primary)] tracking-tight mt-12 mb-4 scroll-mt-24">
      <a href={`#${id}`} className="no-underline text-inherit">{children}<AnchorIcon /></a>
    </h1>
  );
}

function H2({ children }: { children?: React.ReactNode }) {
  const id = slugify(String(children ?? ''));
  return (
    <h2 id={id} className="group font-sans font-semibold text-[22px] md:text-[24px] text-[var(--color-text-primary)] tracking-tight mt-10 mb-3 scroll-mt-24">
      <a href={`#${id}`} className="no-underline text-inherit">{children}<AnchorIcon /></a>
    </h2>
  );
}

function H3({ children }: { children?: React.ReactNode }) {
  const id = slugify(String(children ?? ''));
  return (
    <h3 id={id} className="group font-sans font-semibold text-[18px] md:text-[20px] text-[var(--color-text-primary)] tracking-tight mt-8 mb-2 scroll-mt-24">
      <a href={`#${id}`} className="no-underline text-inherit">{children}<AnchorIcon /></a>
    </h3>
  );
}

function H4({ children }: { children?: React.ReactNode }) {
  const id = slugify(String(children ?? ''));
  return (
    <h4 id={id} className="group font-sans font-semibold text-[16px] text-[var(--color-text-primary)] tracking-tight mt-6 mb-2 scroll-mt-24">
      <a href={`#${id}`} className="no-underline text-inherit">{children}<AnchorIcon /></a>
    </h4>
  );
}

function P({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-[16px] md:text-[17px] leading-[1.75] text-[var(--color-text-secondary)] mb-5 max-w-[65ch]">
      {children}
    </p>
  );
}

function A({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href?.startsWith('http');
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--color-gold)] hover:underline transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href ?? '#'} className="text-[var(--color-gold)] hover:underline transition-colors">
      {children}
    </Link>
  );
}

function Blockquote({ children }: { children?: React.ReactNode }) {
  return (
    <blockquote className="border-l-2 border-[var(--color-gold)] bg-[var(--color-bg-elevated)] pl-5 pr-4 py-3 my-6 rounded-r-sm [&>p]:mb-0 [&>p]:text-[var(--color-text-secondary)]">
      {children}
    </blockquote>
  );
}

function Pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <pre className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm px-5 py-4 my-6 overflow-x-auto font-mono text-[13px] leading-relaxed text-[var(--color-text-primary)]" {...props}>
      {children}
    </pre>
  );
}

function Code({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
  // Inline code (not inside a pre block)
  const isBlock = typeof children === 'object';
  if (isBlock) return <code {...props}>{children}</code>;
  return (
    <code className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] text-[var(--color-gold)] font-mono text-[0.875em] px-1.5 py-0.5 rounded-sm" {...props}>
      {children}
    </code>
  );
}

function Ul({ children }: { children?: React.ReactNode }) {
  return (
    <ul className="list-disc list-outside pl-6 mb-5 space-y-2 text-[16px] md:text-[17px] leading-[1.75] text-[var(--color-text-secondary)] max-w-[65ch] marker:text-[var(--color-gold)]">
      {children}
    </ul>
  );
}

function Ol({ children }: { children?: React.ReactNode }) {
  return (
    <ol className="list-decimal list-outside pl-6 mb-5 space-y-2 text-[16px] md:text-[17px] leading-[1.75] text-[var(--color-text-secondary)] max-w-[65ch] marker:text-[var(--color-gold)]">
      {children}
    </ol>
  );
}

function Li({ children }: { children?: React.ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

function Hr() {
  return <hr className="border-[var(--color-border-base)] my-10" />;
}

function Table({ children }: { children?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-6 border border-[var(--color-border-base)] rounded-[4px]">
      <table className="w-full border-collapse text-[14px] text-[var(--color-text-secondary)]">
        {children}
      </table>
    </div>
  );
}

function Thead({ children }: { children?: React.ReactNode }) {
  return (
    <thead className="bg-[var(--color-bg-elevated)] text-left">
      {children}
    </thead>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3.5 py-2.5 border-b border-[var(--color-border-base)] font-medium font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td className="px-3.5 py-2.5 border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[14px] text-[var(--color-text-secondary)] [&>strong]:text-[var(--color-text-primary)]">
      {children}
    </td>
  );
}

function Tr({ children }: { children?: React.ReactNode }) {
  return (
    <tr className="even:[&>td]:bg-[var(--color-bg-elevated)]">
      {children}
    </tr>
  );
}

function Img({ src, alt }: { src?: string; alt?: string }) {
  if (!src) return null;
  return (
    <figure className="my-8">
      <Image
        src={src}
        alt={alt ?? ''}
        width={800}
        height={450}
        className="w-full rounded-sm border border-[var(--color-border-base)]"
        loading="lazy"
      />
      {alt && (
        <figcaption className="mt-2 text-center text-[13px] text-[var(--color-text-muted)]">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

/* ── Custom Blog Components ── */

export function ComparisonTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-6 border border-[var(--color-border-base)] rounded-[4px]">
      <table className="w-full border-collapse text-[14px] text-[var(--color-text-secondary)]">
        <thead className="bg-[var(--color-bg-elevated)] text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3.5 py-2.5 border-b border-[var(--color-border-base)] font-medium font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:[&>td]:bg-[var(--color-bg-elevated)]">
              {row.map((cell, j) => (
                <td key={j} className="px-3.5 py-2.5 border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[14px] text-[var(--color-text-secondary)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CTACard({
  title = 'Try Helm Terminal',
  description = 'Institutional-grade financial intelligence for individuals.',
  href = 'https://helmterminal.dev/analyze',
  buttonText = 'Get Started Free',
}: {
  title?: string;
  description?: string;
  href?: string;
  buttonText?: string;
}) {
  return (
    <div className="my-8 bg-[var(--color-bg-elevated)] border border-[var(--color-gold-border)] rounded-sm p-6">
      <h4 className="font-sans font-semibold text-[18px] text-[var(--color-text-primary)] mb-2">
        {title}
      </h4>
      <p className="text-[15px] text-[var(--color-text-secondary)] mb-4">{description}</p>
      <a
        href={href}
        className="inline-block bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-text-inverse)] font-medium text-[14px] px-5 py-2 rounded-sm transition-colors"
      >
        {buttonText}
      </a>
    </div>
  );
}

export function ProTip({ children }: { children?: React.ReactNode }) {
  return (
    <div className="my-6 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-sm p-5">
      <div className="flex items-start gap-3">
        <span className="text-[var(--color-gold)] font-mono text-[12px] font-medium uppercase tracking-wider mt-0.5 shrink-0">
          Pro Tip
        </span>
        <div className="text-[15px] leading-[1.7] text-[var(--color-text-secondary)] [&>p]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Component map for MDX ── */

export const mdxComponents: MDXComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  p: P,
  a: A as any,
  blockquote: Blockquote,
  pre: Pre,
  code: Code,
  ul: Ul,
  ol: Ol,
  li: Li,
  hr: Hr,
  table: Table,
  thead: Thead,
  th: Th,
  td: Td,
  tr: Tr,
  img: Img as any,
  ComparisonTable,
  CTACard,
  ProTip,
};
