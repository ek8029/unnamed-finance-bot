import Link from 'next/link';

export const metadata = {
  title: 'Unsubscribed — Helm Terminal',
  robots: { index: false },
};

export default async function WatchUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = error === '1';
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-[var(--color-border-base)] rounded-lg p-8 text-center">
        <p className="type-eyebrow text-[var(--color-text-muted)] mb-3">
          {failed ? 'Link problem' : 'Unsubscribed'}
        </p>
        <h1 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
          {failed ? 'That link did not work.' : 'Helm stopped watching.'}
        </h1>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-6">
          {failed
            ? 'The unsubscribe link is invalid. Reply to any watch email and we will remove you manually.'
            : 'No more emails. If you change your mind, subscribe again from any analysis page.'}
        </p>
        <Link
          href="/analyze"
          className="inline-block px-6 py-3 border border-[var(--color-border-base)] hover:border-[var(--color-gold)] text-[var(--color-text-primary)] text-[14px] font-semibold rounded transition-colors"
        >
          Back to Analyze
        </Link>
      </div>
    </div>
  );
}
