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
      <nav className="border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <HelmMark size={36} />
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</div>
              <div className="type-eyebrow text-[var(--color-text-muted)]">Financial Intelligence</div>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <div className="mb-10">
          <h1 className="type-h1 text-3xl text-[var(--color-text-primary)] mb-2">{title}</h1>
          <p className="type-eyebrow text-[var(--color-text-muted)]">Last updated: {lastUpdated}</p>
        </div>
        <div className="prose-helm space-y-8">{children}</div>
      </div>

      <LegalFooter />
    </main>
  );
}
