// 04 · The weekly digest. The email that makes the book get opened.
//
// Spec §2.3: the habit is not the dashboard, it is the note that says something
// happened. Kitces: 16-20 touchpoints a year and only 1-2 are meetings; the
// digest is one of the other fourteen. Numbers first, then the names a document
// tested, then what reports next week, then the items that need a person.
// Never a forecast. On a quiet week the whole email is the one line at the end.

import Link from 'next/link';
import { BOOK_ROLLUPS, DIGEST, FIRM, NAMES, TAIL, mdy, usd } from '../_data';

export default function AdvisorDigest() {
  const tested = NAMES.filter((n) => n.lastTest && n.lastTest.date >= DIGEST.testedFrom);
  const reporting = NAMES.filter(
    (n) => n.nextEarnings && n.nextEarnings >= DIGEST.earningsFrom && n.nextEarnings <= DIGEST.earningsTo,
  );

  return (
    <main className="adv-page">
      <div className="adv-mail-meta">
        <span>To: {DIGEST.to} · cc {DIGEST.cc}</span>
        <span>{DIGEST.sent}</span>
      </div>

      <div className="adv-mail">
        <div className="adv-mail-head">
          <span className="adv-strip-name">Helm <span>for advisors</span></span>
          <span className="adv-eyebrow">{DIGEST.weekLabel}</span>
        </div>

        <h1>Your book last week: one reason to own something was contradicted, three things need you, twenty-seven households were quiet.</h1>
        <p className="pre">Every single name across all 38 households was read every trading day, in the accounts you manage and the accounts your clients run. Here is what came of it.</p>

        <div className="adv-mail-nums">
          <div><b>{DIGEST.documentsRead.toLocaleString('en-US')}</b><span>Documents read</span></div>
          <div><b>{tested.length}</b><span>Names tested</span></div>
          <div><b>3</b><span>Need you</span></div>
          <div><b>{BOOK_ROLLUPS.quiet}</b><span>Quiet households</span></div>
        </div>

        <div className="adv-mail-item">
          <b>Names tested this week across the book</b>
          <p>A document said something that bears on the written reason for owning these. Everything else stood.</p>
          <table className="adv-table" style={{ marginTop: 10 }}>
            <tbody>
              {tested.map((n) => (
                <tr key={n.ticker}>
                  <td style={{ width: 62, fontFamily: 'var(--mono)', fontWeight: 600 }}>{n.ticker}</td>
                  <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14 }}>&ldquo;{n.lastTest!.quote}&rdquo;</span>
                    <span className="adv-note-src" style={{ display: 'block', marginTop: 4 }}>
                      {n.lastTest!.source} · {n.households} households, {n.reasonsOnFile} with a reason
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="adv-mail-item">
          <b>Earnings this week</b>
          <p>Names your households hold that report between {mdy(DIGEST.earningsFrom)} and {mdy(DIGEST.earningsTo)}. Each one is a document that will test a reason on file, or fail to.</p>
          <table className="adv-table" style={{ marginTop: 10 }}>
            <tbody>
              {reporting.map((n) => (
                <tr key={n.ticker}>
                  <td style={{ width: 66, fontFamily: 'var(--mono)', fontWeight: 600 }}>{n.ticker}</td>
                  <td style={{ fontSize: 13 }}>{n.name}</td>
                  <td className="num" style={{ fontSize: 12.5 }}>{n.households} households</td>
                  <td className="num dim" style={{ fontSize: 12.5 }}>{n.reasonsOnFile} with a reason</td>
                  <td className="num" style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{mdy(n.nextEarnings!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="adv-note-src" style={{ display: 'block', marginTop: 8 }}>
            {TAIL.earningsThisWeek} more names in the tail report in the same window. None of them carries a reason on file.
          </span>
        </div>

        <div className="adv-mail-item">
          <b>NVDA: the 10-Q describes supply catching up with demand. 11 households.</b>
          <p>The supply constraint behind the position is no longer something the company says about itself. The order book it reports is still large. A note is drafted for each household, in your voice, with the filing quoted and April&rsquo;s call revisited.</p>
          <span className="adv-note-src">Form 10-Q, filed 2026-08-25, p. 23 · 64% of the exposure sits in accounts the clients run themselves</span>
        </div>

        <div className="adv-mail-item">
          <b>Lindqvist: 1,900 MU shares vest September 1.</b>
          <p>The household goes from 24% to 31% in one name. In the accounts you manage it reads 4%. Worth raising before the vest rather than after, and the cost basis arrives with the shares.</p>
          <span className="adv-note-src">Vest schedule from the linked E*TRADE account</span>
        </div>

        <div className="adv-mail-item">
          <b>Berglund revoked the Robinhood link.</b>
          <p>Her choice, no approval needed, and the $118K in that account is now out of view. What you saw before Tuesday 21:14 stays in the record. If it was an accident, she can relink from her settings in one step.</p>
          <span className="adv-note-src">Plaid Portal · Tuesday 21:14 ET</span>
        </div>

        <div className="adv-mail-item">
          <b>Harvestable losses stand at {usd(BOOK_ROLLUPS.harvestable.total)} across {BOOK_ROLLUPS.harvestable.households} households, taxable accounts only.</b>
          <p>Realized if sold, computed from average cost. Marchetti Family Trust carries $31,900 of it. The window closes December 31; nothing here is urgent in August.</p>
        </div>

        <div className="adv-mail-item" style={{ borderBottom: 0 }}>
          <b>Last week you sent 6 notes. Two clients wrote back.</b>
          <p>Okafor asked about RIVN in the Robinhood account. Castellano confirmed the AAPL trim. Both are logged against the household.</p>
        </div>

        <div style={{ marginTop: 18 }}>
          <Link href="/testing/advisor/book?view=name" className="adv-btn fill">The book, by name</Link>
          <Link href="/testing/advisor/note" className="adv-btn">Review the drafts</Link>
        </div>

        <div className="adv-mail-foot">
          Helm reads and cites. It never trades, moves money, or contacts a client. Every figure above links to the document or account it came from. On a week with nothing to report, this email is one line.<br />
          {FIRM.name} · Digest settings · Sent Mondays at 6:45 AM ET
        </div>
      </div>
    </main>
  );
}
