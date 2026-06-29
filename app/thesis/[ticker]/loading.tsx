import { CinematicBg } from '@/components/cinematic-bg';

// Lightweight skeleton while the thesis page (ISR) revalidates. Mirrors the /masthead aesthetic.
export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg gridAmbient={false} />
      <section className="relative z-10 container mx-auto px-6 pt-16 pb-24 max-w-3xl animate-pulse">
        <div className="h-3 w-48 rounded bg-[var(--color-border-base)] mb-6" />
        <div className="h-10 w-3/4 rounded bg-[var(--color-border-base)] mb-4" />
        <div className="h-3 w-56 rounded bg-[var(--color-border-base)] mb-10" />
        <div className="space-y-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-6">
              <div className="h-5 w-2/3 rounded bg-[var(--color-border-base)] mb-3" />
              <div className="h-3 w-1/2 rounded bg-[var(--color-border-base)] mb-5" />
              <div className="h-20 w-full rounded bg-black/30" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
