import Link from 'next/link';

export interface PillarSummary {
  intact: number;
  weakening: number;
  broken: number;
  unverified: number;
  positions: number;
  lastScannedAt: string | null;
}

function formatScannedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function QuietState({ summary }: { summary: PillarSummary }) {
  const total = summary.intact + summary.weakening + summary.broken;
  const hasIssues = summary.weakening + summary.broken > 0;

  const heading =
    summary.positions === 0
      ? 'No theses tracked yet.'
      : hasIssues
      ? `${summary.intact} of ${total} pillars intact across ${summary.positions} positions.`
      : `All ${summary.intact} pillars intact across ${summary.positions} positions.`;

  return (
    <div className="flex overflow-hidden rounded-[4px] border border-white/[0.06] bg-[#131313]">
      {/* 3px green spine */}
      <div className="w-[3px] shrink-0 bg-[#4ADE80]" style={{ opacity: 0.7 }} />

      <div className="flex-1 px-[40px] py-[40px] pb-[32px]">
        {/* Heading */}
        <h2 className="m-0 mb-4 text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-[#FAFAFA]">
          {heading}
        </h2>

        {summary.positions === 0 ? (
          /* Empty state body */
          <>
            <p
              className="m-0 mb-5 text-[17px] leading-[1.55] text-[#9A9A9A]"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
            >
              When you add a position, tell Helm why you own it. It will watch filings, insider activity and headlines so you know when something changes.
            </p>
            <Link
              href="/dashboard/portfolio"
              className="text-[14px] font-semibold text-[#E6B94D] hover:text-[#FFD67A] transition-colors underline-offset-2 hover:underline"
            >
              Set up your first thesis
            </Link>
          </>
        ) : (
          /* Quiet state body */
          <>
            <p
              className="m-0 mb-6 text-[17px] leading-[1.55] text-[#9A9A9A] max-w-[560px]"
              style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}
            >
              Nothing threatens your theses today. Helm scanned filings, insider activity and headlines overnight.
            </p>

            {/* Last scanned stamp */}
            {summary.lastScannedAt && (
              <div
                className="font-mono text-[11.5px] tracking-[0.06em] text-[#4A4A4A] tabular-nums"
                style={{ fontFamily: "'Space Grotesk', monospace" }}
              >
                Last scanned {formatScannedAt(summary.lastScannedAt)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
