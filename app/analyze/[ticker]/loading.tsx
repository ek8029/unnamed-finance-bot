import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { AnalysisLoadingTerminal } from '@/components/analysis-loading-terminal';

export default function AnalysisLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <header className="relative z-10 glass-nav">
        <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <HelmMark size={24} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </a>
          <a
            href="/analyze"
            className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Analyze
          </a>
        </div>
      </header>

      {/* Terminal loading animation */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <AnalysisLoadingTerminal />
      </main>
    </div>
  );
}
