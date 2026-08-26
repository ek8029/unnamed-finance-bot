// 01 · The book. The advisor's morning screen.
//
// Order follows the research: what needs you (event-triggered, cited), then the
// ledger of every household with held-away counted in, then the book roll-ups.
// The quiet rows are kept visible: "27 households, nothing changed" is the
// product (Carl Richards' "we looked at your stuff, everything's fine").

import Link from 'next/link';
import { BOOK_ROLLUPS, FIRM, HOUSEHOLDS, MEETINGS, OVERNIGHT, STALE, pct, usd } from '../_data';

export default function AdvisorBook() {
  const changed = HOUSEHOLDS.filter((h) => h.changed);
  const quiet = HOUSEHOLDS.filter((h) => !h.changed);

  return (
    <main className="adv-page">
      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">{FIRM.date} · {FIRM.time}</div>
          <h1 className="adv-h1">
            Good morning, Sarah. <em>Four households need you.</em>
          </h1>
          <p className="adv-lede">
            61 of 61 accounts synced by 06:14. Prices as of 06:20. Overnight, Helm read 214 documents touching positions
            your households hold and found one that changes a reason someone owns something.
          </p>
        </div>
        <div className="adv-head-meta">
          <b>{FIRM.households}</b> households · <b>{FIRM.accounts}</b> accounts<br />
          {usd(FIRM.aum, { compact: true })} in view · <b>{pct(FIRM.heldAwayShare, 0)}</b> held away<br />
          Reviewed this week: <b>{BOOK_ROLLUPS.reviewedThisWeek.n}</b> of {BOOK_ROLLUPS.reviewedThisWeek.of}
        </div>
      </div>

      <div className="adv-cols">
        <div>
          {/* ── overnight ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Overnight · what needs you</span>
              <small>3 items · the rest of the book is below</small>
            </div>
            <div className="adv-events">
              {OVERNIGHT.map((e) => (
                <div key={e.title} className="adv-event">
                  <div className="adv-event-when">
                    {e.when.split('\n').map((l) => <div key={l}>{l}</div>)}
                    <div style={{ marginTop: 4 }}><span className="adv-chip">{e.kind}</span></div>
                  </div>
                  <div className="adv-event-what">
                    <b>{e.title}</b>
                    {e.quote && <div className="q">&ldquo;{e.quote}&rdquo;</div>}
                    <div className="adv-event-src">{e.source}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-2)' }}>{e.scope}</div>
                  </div>
                  <div className="adv-event-act">
                    <Link href={e.href} className="adv-btn">{e.action}</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── ledger ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">The book</span>
              <small>held-away accounts included · what changed first · 10 of 38</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Next review</th>
                  <th className="num">Total</th>
                  <th>Held away</th>
                  <th>Largest position</th>
                  <th className="num">Breaches</th>
                  <th className="num">Harvestable</th>
                  <th className="num">Synced</th>
                </tr>
              </thead>
              <tbody>
                {[...changed, ...quiet].map((h) => {
                  const heldAway = h.total - h.custodied;
                  return (
                    <tr key={h.id} className={h.changed ? '' : 'row-quiet'}>
                      <td className="name">
                        <span className={`adv-mark ${h.breaches ? 'neg' : h.changed ? '' : 'none'}`} />
                        <Link href={h.id === 'okafor' ? '/testing/advisor/client' : '#'}>{h.name}</Link>
                        {h.note && <span className="sub">{h.note}</span>}
                      </td>
                      <td style={{ minWidth: 118 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{MEETINGS[h.id].next}</span>
                        <span className="sub">{MEETINGS[h.id].topic}</span>
                      </td>
                      <td className="num">{usd(h.total, { compact: true })}</td>
                      <td style={{ minWidth: 150 }}>
                        {heldAway > 0 ? (
                          <>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{pct(heldAway / h.total, 0)}</span>
                            <span className="dim" style={{ fontSize: 11.5 }}> · {h.heldAwayAccounts} acct{h.heldAwayAccounts > 1 ? 's' : ''}</span>
                            <div className="adv-scale"><i className="held" style={{ width: pct(heldAway / h.total, 0) }} /></div>
                          </>
                        ) : (
                          <span className="dim">none linked</span>
                        )}
                      </td>
                      <td style={{ minWidth: 190 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{h.largest.ticker} {pct(h.largest.weight, 0)}</span>
                        {h.largest.weight - h.largest.custodiedWeight > 0.02 && (
                          <span className="sub">in your custody it reads {pct(h.largest.custodiedWeight, 0)}</span>
                        )}
                        <div className="adv-scale">
                          <i style={{ width: pct(h.largest.custodiedWeight, 0) }} />
                          <i className="held" style={{ left: pct(h.largest.custodiedWeight, 0), width: pct(h.largest.weight - h.largest.custodiedWeight, 0) }} />
                          <b style={{ left: '20%' }} title="20% single-name line" />
                        </div>
                      </td>
                      <td className="num">{h.breaches ? <span className="adv-neg">{h.breaches}</span> : <span className="dim">0</span>}</td>
                      <td className="num">
                        {h.harvestable === null ? <span className="dim" title="No taxable account with a loss">n/a</span> : h.harvestable === 0 ? <span className="dim">0</span> : usd(h.harvestable)}
                      </td>
                      <td className="num">
                        {STALE[h.id] ? (
                          <span className="adv-neg" title={STALE[h.id]} style={{ fontSize: 11.5 }}>34 d · reconnect</span>
                        ) : (
                          <span className="dim">{h.lastSync}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
              {BOOK_ROLLUPS.quiet} households: nothing changed since Friday. Every one of them was read. One connection needs the client: Whitfield&rsquo;s Fidelity 401(k), 34 days since its last sync.
            </div>
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="adv-rail">
          <div className="adv-eyebrow">Across the book</div>

          <div className="adv-stat">
            <div className="adv-stat-n">NVDA <small>{pct(BOOK_ROLLUPS.nvda.bookShare)}</small></div>
            <div className="adv-stat-l">
              <b>{BOOK_ROLLUPS.nvda.households} households</b> hold it, 4 above their own limit. {pct(BOOK_ROLLUPS.nvda.heldAwayShare, 0)} of the exposure is in accounts you do not custody.
            </div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: '36%' }} /><i className="held" style={{ left: '36%', width: '64%' }} />
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{usd(BOOK_ROLLUPS.harvestable.total, { compact: true })}</div>
            <div className="adv-stat-l">
              Harvestable losses across <b>{BOOK_ROLLUPS.harvestable.households} households</b>, taxable accounts only. Realized if sold. The window closes Dec 31.
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-eyebrow" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>Open breaches by ticker</div>
            <table className="adv-table" style={{ fontSize: 12.5 }}>
              <tbody>
                {BOOK_ROLLUPS.breaches.map((b) => (
                  <tr key={b.ticker}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{b.ticker}</td>
                    <td className="dim">{b.pillar}</td>
                    <td className="num adv-neg">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{BOOK_ROLLUPS.quiet} <small>quiet</small></div>
            <div className="adv-stat-l">Households where nothing in yesterday’s documents tested a reason to own anything. Each was read in full.</div>
          </div>

          <div className="adv-stat">
            <div className="adv-eyebrow" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>Scorecard · this week</div>
            <div className="adv-stat-l">Households reviewed <b>31 / 38</b><br />Notes sent <b>6</b><br />Client-initiated calls <b>2</b></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
