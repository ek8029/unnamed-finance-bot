import { SiteNav } from '@/components/site-nav';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { ArrowLeft } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      {/* Nav */}
      <SiteNav />

      {/* Content */}
      <div className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold uppercase tracking-wider text-[var(--color-text-primary)] mb-2">{title}</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono">Last updated: {lastUpdated}</p>
        </div>
        <div className="prose-helm space-y-8">{children}</div>
      </div>

      <LegalFooter />
    </main>
  );
}
