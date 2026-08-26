// 04 · The weekly digest. The email that makes the book get opened.
//
// Spec §2.3: the habit is not the dashboard, it is the note that says something
// happened. Kitces: 16-20 touchpoints a year and only 1-2 are meetings; the
// digest is one of the other fourteen. Numbers first, then the three items
// that need a person, then what went out last week. Never a forecast.

import Link from 'next/link';
import { BOOK_ROLLUPS, FIRM } from '../_data';

export default function AdvisorDigest() {
  return (
    <main className="adv-page">
      <div className="adv-mail-meta">
        <span>To: sarah@larkspurwealth.com</span>
        <span>Monday, August 24, 2026 · 6:45 AM</span>
      </div>

      <div className="adv-mail">
        <div className="adv-mail-head">
          <span className="adv-strip-name">Helm <span>for advisors</span></span>
          <span className="adv-eyebrow">Week of Aug 17</span>
        </div>

        <h1>Your book last week: one reason to own something changed, three things need you, twenty-seven households were quiet.</h1>
        <p className="pre">Every position across all 38 households was read every trading day. Here is what came of it.</p>

        <div className="adv-mail-nums">
          <div><b>1,412</b><span>Documents read</span></div>
          <div><b>1</b><span>Reason contradicted</span></div>
          <div><b>3</b><span>Need you</span></div>
          <div><b>{BOOK_ROLLUPS.quiet}</b><span>Quiet households</span></div>
        </div>

        <div className="adv-mail-item">
          <b>NVDA: the 10-Q describes supply catching up with demand. 11 households.</b>
          <p>The supply-constraint pillar behind the position is no longer something the company says about itself. The order book it reports is still large. A note is drafted for each household, in your voice, with the filing quoted and April&rsquo;s call revisited.</p>
          <span className="adv-note-src">Form 10-Q, filed 2026-08-25, p. 23 · 64% of the exposure is in accounts you do not custody</span>
        </div>

        <div className="adv-mail-item">
          <b>Lindqvist: 1,900 MU shares vest September 1.</b>
          <p>The household goes from 24% to 31% in one name. On the Schwab statements it reads 4%. Worth raising before the vest rather than after, and the lots will arrive with cost basis attached.</p>
          <span className="adv-note-src">Vest schedule from the linked E*TRADE account</span>
        </div>

        <div className="adv-mail-item">
          <b>Berglund revoked the Robinhood link.</b>
          <p>Her choice, no approval needed, and the $118K in that account is now out of view. What you saw before Tuesday 21:14 stays in the record. If it was an accident, she can relink from her settings in one step.</p>
          <span className="adv-note-src">Plaid Portal · Tuesday 21:14 ET</span>
        </div>

        <div className="adv-mail-item">
          <b>Harvestable losses stand at $148,300 across 14 households, taxable accounts only.</b>
          <p>Realized if sold. Marchetti Family Trust carries $31,900 of it. The window closes December 31; nothing here is urgent in August.</p>
        </div>

        <div className="adv-mail-item" style={{ borderBottom: 0 }}>
          <b>Last week you sent 6 notes. Two clients wrote back.</b>
          <p>Okafor asked about RIVN in the Robinhood account. Castellano confirmed the AAPL trim. Both are logged against the household.</p>
        </div>

        <div style={{ marginTop: 18 }}>
          <Link href="/testing/advisor/book" className="adv-btn fill">Open the book</Link>
          <Link href="/testing/advisor/note" className="adv-btn">Review the NVDA notes</Link>
        </div>

        <div className="adv-mail-foot">
          Helm reads and cites. It never trades, moves money, or contacts a client. Every figure above links to the document or account it came from.<br />
          {FIRM.name} · Digest settings · Sent Mondays at 6:45 AM ET
        </div>
      </div>
    </main>
  );
}
