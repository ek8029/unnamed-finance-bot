// 01 · The book. The advisor's morning screen.
//
// What needs you overnight, then the book itself, cut two ways: by household,
// the way the service calendar is organised, and by name, the way the risk
// actually sits. Both counts include accounts under management and accounts
// the client runs. The quiet rows are kept visible: "27 households, nothing
// changed" is the point, not filler.

import Link from 'next/link';
import {
  ALL_POSITIONS,
  ALL_REASONS,
  BOOK_ROLLUPS,
  FIRM,
  HOUSEHOLDS,
  MEETINGS,
  NAMED_POSITIONS,
  NAMED_REASONS,
  NAMES,
  OVERNIGHT,
  STALE,
  TAIL,
  mdy,
  pct,
  usd,
} from '../_data';

const STATUS: Record<string, { text: string; cls: string }> = {
  tested: { text: 'Reason tested', cls: 'neg' },
  holds: { text: 'Nothing tested it', cls: 'none' },
  none: { text: 'No reason to test', cls: '' },
};

export default async function AdvisorBook({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === 'name' ? 'name' : 'household';
  const changed = HOUSEHOLDS.filter((h) => h.changed);
  const quiet = HOUSEHOLDS.filter((h) => !h.changed);
  const nvda = NAMES.find((n) => n.ticker === 'NVDA')!;

  return (
    <main className="adv-page">
      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">{FIRM.date} · {FIRM.time}</div>
          <h1 className="adv-h1">
            Good morning, Sarah. <em>Four households need you.</em>
          </h1>
          <p className="adv-lede">
            61 of 61 accounts synced by 06:14. Prices as of 06:20. Overnight, Helm read 214 documents touching the {ALL_POSITIONS}{' '}
            single-name positions your households hold, and found one that contradicts a written reason for owning something.
          </p>
        </div>
        <div className="adv-head-meta">
          <b>{FIRM.households}</b> households · <b>{FIRM.accounts}</b> accounts<br />
          Under management <b>{usd(FIRM.managed, { compact: true })}</b> · client-linked <b>{usd(FIRM.linked, { compact: true })}</b><br />
          Single names <b>{ALL_POSITIONS}</b> · reason on file <b>{ALL_REASONS}</b> ({pct(ALL_REASONS / ALL_POSITIONS, 0)})
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

          {/* ── the book, cut two ways ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">The book</span>
              <small>
                {view === 'household'
                  ? 'accounts under management and client-linked, counted together · 10 of 38'
                  : `every single name across the firm · ${NAMES.length} largest, then the tail`}
              </small>
            </div>

            <div className="adv-tabs">
              <Link href="/testing/advisor/book" className={view === 'household' ? 'on' : ''}>By household</Link>
              <Link href="/testing/advisor/book?view=name" className={view === 'name' ? 'on' : ''}>By name</Link>
            </div>

            {view === 'household' ? (
              <>
                <table className="adv-table">
                  <thead>
                    <tr>
                      <th>Household</th>
                      <th className="opt">Next review</th>
                      <th className="num">Total</th>
                      <th>Where it sits</th>
                      <th className="opt">Largest position</th>
                      <th className="num opt">Breaches</th>
                      <th className="num">Harvestable</th>
                      <th className="num opt">Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...changed, ...quiet].map((h) => (
                      <tr key={h.id} className={h.changed ? '' : 'row-quiet'}>
                        <td className="name" style={{ minWidth: 142 }}>
                          <span className={`adv-mark ${h.breaches ? 'neg' : h.changed ? '' : 'none'}`} />
                          <Link href={h.id === 'okafor' ? '/testing/advisor/client' : '#'}>{h.name}</Link>
                          {h.note && <span className="sub">{h.note}</span>}
                        </td>
                        <td className="opt" style={{ minWidth: 96 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{MEETINGS[h.id].next}</span>
                          <span className="sub">{MEETINGS[h.id].topic}</span>
                        </td>
                        <td className="num">{usd(h.total, { compact: true })}</td>
                        <td style={{ minWidth: 142 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>Managed {usd(h.managedValue, { compact: true })}</span>
                          <span className="sub">
                            {h.linkedValue > 0
                              ? `Linked ${usd(h.linkedValue, { compact: true })} · ${h.linkedAccounts} acct${h.linkedAccounts > 1 ? 's' : ''}`
                              : 'Nothing linked'}
                          </span>
                          <div className="adv-scale">
                            <i style={{ width: pct(h.managedValue / h.total, 0) }} />
                            {h.linkedValue > 0 && (
                              <i className="held" style={{ left: pct(h.managedValue / h.total, 0), width: pct(h.linkedValue / h.total, 0) }} />
                            )}
                          </div>
                        </td>
                        <td className="opt" style={{ minWidth: 156 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>{h.largest.ticker} {pct(h.largest.weight, 0)}</span>
                          {h.largest.weight - h.largest.managedWeight > 0.02 && (
                            <span className="sub">you manage {pct(h.largest.managedWeight, 0)} of it</span>
                          )}
                          <div className="adv-scale">
                            <i style={{ width: pct(h.largest.managedWeight, 0) }} />
                            <i className="held" style={{ left: pct(h.largest.managedWeight, 0), width: pct(h.largest.weight - h.largest.managedWeight, 0) }} />
                            <b style={{ left: '20%' }} title="20% single-name line" />
                          </div>
                        </td>
                        <td className="num opt">{h.breaches ? <span className="adv-neg">{h.breaches}</span> : <span className="dim">0</span>}</td>
                        <td className="num">
                          {h.harvestable === null ? <span className="dim" title="No taxable account with a loss">n/a</span> : h.harvestable === 0 ? <span className="dim">0</span> : usd(h.harvestable)}
                        </td>
                        <td className="num opt">
                          {STALE[h.id] ? (
                            <span className="adv-neg" title={STALE[h.id]} style={{ fontSize: 11.5 }}>34 d<span className="sub adv-neg">reconnect</span></span>
                          ) : (
                            <span className="dim">{h.lastSync}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
                  {BOOK_ROLLUPS.quiet} households: nothing changed since Friday. Every one of them was read. One connection needs the client: Whitfield&rsquo;s Fidelity 401(k), 34 days since its last sync.
                </div>
              </>
            ) : (
              <>
                <table className="adv-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="num">Firm weight</th>
                      <th className="num opt">Households</th>
                      <th className="num">Reason on file</th>
                      <th>This week</th>
                      <th className="num opt">Next earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NAMES.map((n) => {
                      const s = STATUS[n.status];
                      const gap = n.households - n.reasonsOnFile;
                      return (
                        <tr key={n.ticker} className={n.status === 'holds' ? 'row-quiet' : ''}>
                          <td className="name" style={{ minWidth: 150 }}>
                            <span style={{ fontFamily: 'var(--mono)' }}>{n.ticker}</span>
                            <span className="sub">{n.name}</span>
                          </td>
                          <td className="num" style={{ minWidth: 84 }}>
                            {pct(n.firmWeight, 1)}
                            <div className="adv-scale"><i style={{ width: pct(n.firmWeight / 0.058, 0) }} /></div>
                          </td>
                          <td className="num opt">{n.households}</td>
                          <td className="num" style={{ minWidth: 104, color: gap > 0 ? 'var(--mark-ink)' : undefined }}>
                            {n.reasonsOnFile} of {n.households}
                            {gap > 0 && <span className="sub" style={{ color: 'var(--mark-ink)' }}>{gap} without</span>}
                          </td>
                          <td style={{ maxWidth: 360 }}>
                            <span className={`adv-mark ${s.cls}`} />{s.text}
                            {n.lastTest && (
                              <>
                                <span className="sub opt" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                                  &ldquo;{n.lastTest.quote}&rdquo;
                                </span>
                                <span className="sub" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{n.lastTest.source}</span>
                              </>
                            )}
                          </td>
                          <td className="num dim opt" style={{ minWidth: 84 }}>{n.nextEarnings ? mdy(n.nextEarnings) : 'not set'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
                  {TAIL.names} more single names under {usd(TAIL.under, { compact: true })} apiece, {usd(TAIL.value, { compact: true })} in all, across{' '}
                  {TAIL.households} households. {TAIL.withReason} have a reason on file. Nobody built this tail on purpose; it arrived
                  with transfers, inheritances and old employer plans.
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="adv-rail">
          <div className="adv-eyebrow">Across the book</div>

          <div className="adv-stat">
            <div className="adv-stat-n">NVDA <small>{pct(nvda.firmWeight)}</small></div>
            <div className="adv-stat-l">
              <b>{nvda.households} households</b> hold it, {BOOK_ROLLUPS.nvda.overLimit} above their own limit,{' '}
              {nvda.reasonsOnFile} with a reason on file. {pct(BOOK_ROLLUPS.nvda.linkedShare, 0)} of the exposure sits in accounts
              the clients run themselves.
            </div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: '36%' }} /><i className="held" style={{ left: '36%', width: '64%' }} />
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{NAMED_REASONS} <small>of {NAMED_POSITIONS}</small></div>
            <div className="adv-stat-l">
              Positions in the <b>{NAMES.length} largest names</b> that carry a written reason. In the tail it is{' '}
              <b>{TAIL.withReason} of {TAIL.names}</b>, which is where the work is.
            </div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: pct(NAMED_REASONS / NAMED_POSITIONS, 0) }} />
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{usd(BOOK_ROLLUPS.harvestable.total, { compact: true })}</div>
            <div className="adv-stat-l">
              Harvestable losses across <b>{BOOK_ROLLUPS.harvestable.households} households</b>, taxable accounts only, from
              average cost. Realized if sold. The window closes Dec 31.
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-eyebrow" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>Open breaches by ticker</div>
            <table className="adv-table" style={{ fontSize: 12.5 }}>
              <tbody>
                {BOOK_ROLLUPS.breaches.map((b) => (
                  <tr key={b.ticker}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{b.ticker}</td>
                    <td className="dim">{b.reason}</td>
                    <td className="num adv-neg">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{BOOK_ROLLUPS.quiet} <small>quiet</small></div>
            <div className="adv-stat-l">Households where nothing in yesterday&rsquo;s documents tested a reason to own anything. Each was read in full.</div>
          </div>

          <div className="adv-stat">
            <div className="adv-eyebrow" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>Scorecard · this week</div>
            <div className="adv-stat-l">Households reviewed <b>{BOOK_ROLLUPS.reviewedThisWeek.n} / {BOOK_ROLLUPS.reviewedThisWeek.of}</b><br />Notes sent <b>6</b><br />Client-initiated calls <b>2</b></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
