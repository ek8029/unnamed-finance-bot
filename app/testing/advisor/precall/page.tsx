// 07 · Before the first call. What a prospect firm gets before anything is
// shared: their own 13F-HR read against the companies' own filings. No
// contract, no data, no link, nothing the firm did not already publish. It is
// the demo and the qualifier at once, and it ends by naming what a 13F cannot
// see, which is the reason the per-household view needs their clients.

import Link from 'next/link';
import { PROSPECT, pct, usd } from '../_data';

export default function AdvisorPrecall() {
  const singleValue = PROSPECT.reported * PROSPECT.singleShare;
  const topWeight = PROSPECT.top.reduce((s, t) => s + t.weight, 0);

  return (
    <main className="adv-page">
      <div className="adv-banner">
        <div>
          <span className="adv-eyebrow">Prospect · not a client · public filings only</span>
          <div style={{ marginTop: 2 }}>
            Nothing on this page came from {PROSPECT.firm}. It was built from the firm&rsquo;s own {PROSPECT.filing.form} and from
            the quarterly reports of the companies in it, all of them public.
          </div>
        </div>
        <span className="adv-chip">Nothing signed</span>
      </div>

      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">{PROSPECT.firm} · {PROSPECT.city}</div>
          <h1 className="adv-h1">
            Before the first call, <em>read from what you already file</em>
          </h1>
          <p className="adv-lede">
            Your last {PROSPECT.filing.form} lists {PROSPECT.positions} positions. {PROSPECT.etfCount} of them are funds and carry{' '}
            {pct(PROSPECT.etfShare, 0)} of the reported value. The other {PROSPECT.nameCount} are individual companies, and{' '}
            {PROSPECT.small.count} of those are under {usd(PROSPECT.small.under, { compact: true })} apiece. This page takes the
            eight largest of them and shows the sentence in each company&rsquo;s most recent filing that tests the usual reason
            to own it.
          </p>
        </div>
        <div className="adv-head-meta">
          {PROSPECT.filing.form} for the {PROSPECT.filing.period}<br />
          Filed <b>{PROSPECT.filing.filed}</b> · {PROSPECT.filing.lagDays} days after the period<br />
          Reported <b>{usd(PROSPECT.reported, { compact: true })}</b> across <b>{PROSPECT.positions}</b> positions
        </div>
      </div>

      <div className="adv-cols">
        <div>
          {/* ── the shape of the book ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">What the filing shows</span>
              <small>read 2026-08-26 from EDGAR · no interpretation added</small>
            </div>
            <table className="adv-table">
              <tbody>
                <tr>
                  <td className="name" style={{ width: 240 }}>Funds and ETFs<span className="sub">{PROSPECT.etfCount} positions</span></td>
                  <td className="num" style={{ width: 110 }}>{usd(PROSPECT.reported * PROSPECT.etfShare, { compact: true })}</td>
                  <td className="num" style={{ width: 70 }}>{pct(PROSPECT.etfShare, 0)}</td>
                  <td><div className="adv-scale"><i style={{ width: pct(PROSPECT.etfShare, 0) }} /></div></td>
                </tr>
                <tr>
                  <td className="name">Individual companies<span className="sub">{PROSPECT.nameCount} positions</span></td>
                  <td className="num">{usd(singleValue, { compact: true })}</td>
                  <td className="num">{pct(PROSPECT.singleShare, 0)}</td>
                  <td><div className="adv-scale"><i className="held" style={{ width: pct(PROSPECT.singleShare, 0) }} /></div></td>
                </tr>
                <tr>
                  <td className="name">
                    The eight largest of them
                    <span className="sub">quoted below</span>
                  </td>
                  <td className="num">{usd(PROSPECT.reported * topWeight, { compact: true })}</td>
                  <td className="num">{pct(topWeight, 0)}</td>
                  <td><div className="adv-scale"><i className="held" style={{ width: pct(topWeight, 0) }} /></div></td>
                </tr>
                <tr>
                  <td className="name">
                    Companies under {usd(PROSPECT.small.under, { compact: true })}
                    <span className="sub">{PROSPECT.small.count} positions</span>
                  </td>
                  <td className="num">{usd(PROSPECT.small.value, { compact: true })}</td>
                  <td className="num">{pct(PROSPECT.small.value / PROSPECT.reported, 0)}</td>
                  <td><div className="adv-scale"><i className="held" style={{ width: pct(PROSPECT.small.value / PROSPECT.reported, 0) }} /></div></td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
              {PROSPECT.small.count} companies under {usd(PROSPECT.small.under, { compact: true })} is a tail, not a strategy. It is
              usually what arrives with transfers, inheritances and old employer plans, and it is the part of a book that
              falls out of every review because no single line in it is big enough to matter on its own.
            </div>
          </section>

          {/* ── the eight, tested ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">The eight largest companies, and the sentence that tests each one</span>
              <small>from each company&rsquo;s most recent filing · quoted, dated, nothing added</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="num">Firm weight</th>
                  <th>The sentence</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {PROSPECT.top.map((t) => (
                  <tr key={t.ticker}>
                    <td className="name" style={{ minWidth: 130 }}>
                      <span style={{ fontFamily: 'var(--mono)' }}>{t.ticker}</span>
                      <span className="sub">{t.name}</span>
                    </td>
                    <td className="num" style={{ minWidth: 84 }}>
                      {pct(t.weight, 1)}
                      <div className="adv-scale"><i style={{ width: pct(t.weight / 0.039, 0) }} /></div>
                    </td>
                    <td style={{ maxWidth: 420, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>
                      &ldquo;{t.quote}&rdquo;
                    </td>
                    <td style={{ minWidth: 150, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.04em', color: 'var(--ink-3)' }}>{t.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── the honest limits ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">What a 13F cannot show</span>
              <small>the reasons this page is a start and not an answer</small>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {PROSPECT.blind.map((b) => (
                <li key={b} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, padding: '9px 0', borderTop: '1px solid var(--rule)', fontSize: 14, color: 'var(--ink-2)' }}>
                  <span className="adv-mark none" style={{ marginTop: 6 }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 16, fontSize: 14.5, color: 'var(--ink)', maxWidth: '62ch' }}>
              Everything above came from documents you and these companies have already filed. Nothing was shared with us and
              nothing was signed. The version of this page that is worth having runs per household, on the accounts your
              clients link themselves, and that is the one thing this form cannot give us.
            </p>
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="adv-rail">
          <div className="adv-eyebrow">How this was made</div>
          <div className="adv-stat">
            <div className="adv-stat-l" style={{ lineHeight: 1.7 }}>
              1. Your {PROSPECT.filing.form}, filed {PROSPECT.filing.filed}, pulled from EDGAR.<br />
              2. Every holding sorted into funds and individual companies.<br />
              3. For the eight largest companies, the most recent 10-K, 10-Q or 8-K read in full.<br />
              4. One sentence taken from each, verbatim, that bears on the usual reason to own it.
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>What we did not do</div>
          <div className="adv-stat">
            <div className="adv-guard">
              <span className="adv-struck">&ldquo;Your book underperformed the S&amp;P by 210 basis points.&rdquo;</span>
              <br /><b>Not computed.</b> A 13F has no cost basis, no cash and no flows. Any return figure from it would be
              invented.
              <br /><br />
              <span className="adv-struck">&ldquo;We would trim NVDA and add to the dividend sleeve.&rdquo;</span>
              <br /><b>Not offered.</b> Helm is not an adviser and does not recommend. It quotes the filing and stops.
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>What changes with a client link</div>
          <div className="adv-stat">
            <div className="adv-stat-l">
              Per household rather than per firm. The accounts you custody and the ones your clients run, in one weight.
              A written reason beside each company, and a note when a filing tests it. The client links their own accounts,
              read-only, and can revoke it in one click.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link href="/testing/advisor/book?view=name" className="adv-btn fill">See it on a real book</Link>
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Sent as</div>
          <div className="adv-stat">
            <div className="adv-stat-l" style={{ fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.7 }}>
              One page, PDF, no login<br />
              No tracking pixel<br />
              Nothing to accept, nothing to install<br />
              Regenerated the day it is sent
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
