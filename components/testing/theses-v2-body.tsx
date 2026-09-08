// Theses as a terminal table, v3.2 (2026-07-25).
//
// v3.1 verdict: right density, but stripped past the bone — a thesis page
// about the user's money with no money on it feels empty. This round adds the
// substance back without the clutter: position value and P&L on every row, the
// thesis statement in the expansion, BOTH sides of the evidence (supporting
// tallies, not just threats), kill criteria, NEW markers on fresh stories, next
// earnings dates, and a summary band with real dollars. Mechanisms stay as
// one-line stories with receipts a click down.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { getScoringThesisData } from '@/lib/content/scoring-thesis';
import { getEdgarEarnings } from '@/lib/earnings-edgar';
import { ThesesTableView, type ThesisTablePosition } from '@/components/thesis/theses-table-view';

const MAX_THESES = 30;

export async function ThesesV2Body({
  email,
  labTags = true,
}: {
  email: string;
  /** false on the real site: hides the proposal tag and the account footer. */
  labTags?: boolean;
}) {
  const target = email.trim().toLowerCase();
  if (!target) {
    return <p className="text-[14px] text-[var(--color-text-secondary)] m-0">Pick an account to see its theses.</p>;
  }

  const db = createStaticServiceClient();
  const { data: profile } = await db
    .from('user_profiles')
    .select('id, email')
    .eq('email', target)
    .maybeSingle();
  if (!profile) return <p className="text-[14px] text-[var(--color-text-primary)] m-0">No account for {target}</p>;

  const [{ data: theses }, { data: holdings }, { data: clusterRow }] = await Promise.all([
    db.from('theses').select('ticker, tracked, notes').eq('user_id', profile.id).order('tracked', { ascending: false }),
    db.from('holdings').select('ticker, total_value, unrealised_gain_loss, unrealised_gain_loss_pct').eq('user_id', profile.id),
    db.from('thesis_clusters').select('clusters').eq('user_id', profile.id).maybeSingle(),
  ]);

  // The user's money behind each thesis (multiple lots fold into one line).
  const positions = new Map<string, ThesisTablePosition>();
  let bookTotal = 0;
  for (const h of holdings ?? []) {
    const t = String(h.ticker).toUpperCase();
    const value = Number(h.total_value ?? 0);
    bookTotal += value;
    const prev = positions.get(t) ?? { value: 0, pl: null, plPct: null };
    positions.set(t, {
      value: prev.value + value,
      // Unknown cost basis stays null — coercing it to 0 painted a confident
      // green "+$0" on transfer-in positions Plaid has no basis for.
      pl:
        h.unrealised_gain_loss != null
          ? (prev.pl ?? 0) + Number(h.unrealised_gain_loss)
          : prev.pl,
      plPct: h.unrealised_gain_loss_pct != null ? Number(h.unrealised_gain_loss_pct) : prev.plPct,
    });
  }
  const notesByTicker = new Map(
    (theses ?? []).map((t) => [String(t.ticker).toUpperCase(), (t.notes as string | null) ?? null]),
  );

  const tickers = [...new Set((theses ?? []).map((t) => String(t.ticker).toUpperCase()))].slice(0, MAX_THESES);
  const data = await Promise.all(tickers.map((t) => getScoringThesisData(t, profile.id as string)));

  // Next earnings per ticker (EDGAR, cached ~1h). Best effort.
  const earnings = new Map<string, string | null>();
  await Promise.allSettled(
    data.map(async (d) => {
      const e = await getEdgarEarnings(d.ticker);
      earnings.set(d.ticker, e.nextEstimatedDate);
    }),
  );

  return (
    <ThesesTableView
      data={data}
      positions={positions}
      bookTotal={bookTotal}
      earnings={earnings}
      notesByTicker={notesByTicker}
      clusters={clusterRow?.clusters}
      accountEmail={profile.email}
      labTags={labTags}
    />
  );
}
