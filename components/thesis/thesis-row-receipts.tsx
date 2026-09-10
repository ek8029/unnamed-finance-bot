'use client';

// One theses-table row's receipts, loaded when the row is opened.
//
// The row bodies used to ship with the page: 21 tickers and about 170 mechanism
// lines made /dashboard/theses answer with 1.19MB of HTML, of which every row
// body was hidden behind a closed disclosure. Measured 2026-09-10: the same
// data as JSON (/api/thesis/board) answered in 978ms while the page took 3.0 to
// 3.5s. The page design has always said receipts are one click down, so now
// they are fetched on that click, one ticker at a time.
//
// The summary line, every number on it and the row order are untouched and
// still server-rendered. Only what sits behind the disclosure moves.

import { useEffect, useRef, useState } from 'react';
import { PillarLine, PillarLinesPending } from '@/components/thesis/thesis-receipts';
import type { PillarReceipts } from '@/lib/content/thesis-board';

export function ThesisRowReceipts({
  ticker,
  /** Pillars the server counted, so the pending body stands at the right height. */
  pillarCount,
}: {
  ticker: string;
  pillarCount: number;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [pillars, setPillars] = useState<PillarReceipts[] | null>(null);
  const [failed, setFailed] = useState(false);

  // The disclosure is the native <details> this body sits in, rendered on the
  // server one level up. Listening to its toggle keeps the summary and its
  // numbers out of the client bundle entirely.
  useEffect(() => {
    const row = anchor.current?.closest('details');
    if (!row) return;
    let live = true;
    let asked = false;

    const load = () => {
      if (asked) return;
      asked = true;
      fetch(`/api/thesis/board?ticker=${encodeURIComponent(ticker)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { pillars?: PillarReceipts[] } | null) => {
          if (!live) return;
          if (body?.pillars) setPillars(body.pillars);
          else {
            // Let the next open try again rather than stranding the row.
            asked = false;
            setFailed(true);
          }
        })
        .catch(() => {
          if (!live) return;
          asked = false;
          setFailed(true);
        });
    };

    // Opened before hydration (a click, or the browser restoring the row).
    if (row.open) load();
    const onToggle = () => {
      if (row.open) load();
    };
    row.addEventListener('toggle', onToggle);
    return () => {
      live = false;
      row.removeEventListener('toggle', onToggle);
    };
  }, [ticker]);

  return (
    <div ref={anchor}>
      {pillars ? (
        pillars.map((p) => <PillarLine key={p.key} p={p} />)
      ) : failed ? (
        <p className="pt-2.5 text-[13px] text-[var(--color-text-secondary)] m-0">
          The receipts for this row did not load. Close and open the row to try again, or read the full
          history below.
        </p>
      ) : (
        <PillarLinesPending count={pillarCount} />
      )}
    </div>
  );
}
