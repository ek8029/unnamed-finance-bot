import Link from 'next/link';

export const metadata = {
  title: 'Helm is watching — Helm Terminal',
  robots: { index: false },
};

export default async function WatchConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = error === '1';
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-[var(--color-border-base)] rounded-lg p-8 text-center">
        <p className="type-eyebrow text-[var(--color-gold)] mb-3">
          {failed ? 'Link problem' : 'Confirmed'}
        </p>
        <h1 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
          {failed ? 'That link did not work.' : 'Helm is on watch.'}
        </h1>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-6">
          {failed
            ? 'The confirmation link is invalid or expired. Subscribe again from any analysis page and we will send a fresh one.'
            : 'From here on, Helm reads the filings, news, and price action on your tickers. You get an email only when something actually changes. Quiet inbox means nothing broke.'}
        </p>
        {!failed && (
          <p className="text-[13px] text-[var(--color-text-secondary)] mb-6">
            Want the full picture: portfolio sync, thesis tracking, and the daily brief?
          </p>
        )}
        <Link
          href={failed ? '/analyze' : '/signup'}
          className="inline-block px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[14px] font-semibold rounded transition-colors"
        >
          {failed ? 'Back to Analyze' : 'Create your free account'}
        </Link>
      </div>
    </div>
  );
}
