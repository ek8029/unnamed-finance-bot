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
      <nav className="border-b border-white/[0.06] bg-[rgba(10,10,10,0.85)] backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase text-[var(--color-text-primary)]">
              Helm
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
        </div>
      </nav>

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
