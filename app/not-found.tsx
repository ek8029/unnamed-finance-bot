import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <nav className="container mx-auto px-6 py-5">
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
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="font-mono text-[var(--color-gold)] text-[13px] uppercase tracking-wider mb-4">
            404
          </p>
          <h1 className="font-sans font-bold text-[28px] text-[var(--color-text-primary)] tracking-tight mb-3">
            Page not found
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/"
              className="text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Home
            </Link>
            <span className="text-[var(--color-border-base)]">&middot;</span>
            <Link
              href="/analyze"
              className="text-[14px] text-[var(--color-gold)] hover:underline transition-colors"
            >
              Free Stock Analysis
            </Link>
            <span className="text-[var(--color-border-base)]">&middot;</span>
            <Link
              href="/blog"
              className="text-[14px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Blog
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
