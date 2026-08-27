// 02 · One household. Every single name it owns, wherever the account sits.
//
// Accounts under management beside accounts the client runs, taxable beside
// retirement, and the reason register beside each single name: the written
// reason, or nothing, which is the finding. The banner is not decoration:
// read-only and revocable is the legal lane.

import Link from 'next/link';
import { OKAFOR, RULES, pct, usd } from '../_data';

const REASON_LABEL: Record<string, { text: string; cls: string }> = {
  contradicted: { text: 'Reason contradicted', cls: 'neg' },
  weakening: { text: 'Reason weakening', cls: '' },
  holds: { text: 'Still fits', cls: 'pos' },
  index: { text: 'Nothing to test', cls: 'none' },
  none: { text: 'No reason to test', cls: '' },
};

const TESTED_FROM = '2026-08-24';

export default function AdvisorClient() {
  const total = OKAFOR.accounts.reduce((s, a) => s + a.value, 0);
  const managed = OKAFOR.accounts.filter((a) => a.custody === 'managed');
  const linked = OKAFOR.accounts.filter((a) => a.custody === 'linked');
  const managedValue = managed.reduce((s, a) => s + a.value, 0);
  const taxable = OKAFOR.accounts.filter((a) => a.tax === 'taxable').reduce((s, a) => s + a.value, 0);
  const harvestTotal = OKAFOR.harvest.reduce((s, h) => s + h.loss, 0);

  const singles = OKAFOR.positions.filter((p) => p.reason !== 'index');
  const withReason = singles.filter((p) => p.reason !== null);
  const testedThisWeek = singles.filter((p) => p.lastTest && p.lastTest.date >= TESTED_FROM);

  const groups = [
    { key: 'managed', title: 'Under your management', sub: 'Larkspur custodies these. A harvest here is one you can place.', accounts: managed },
    { key: 'linked', title: 'Accounts the client runs', sub: 'June linked these herself. You can read them, and nothing else.', accounts: linked },
  ];

  return (
    <main className="adv-page">
      <div className="adv-banner">
        <div>
          <span className="adv-eyebrow">Read-only view</span>
          <div style={{ marginTop: 2 }}>
            Granted by <b>{OKAFOR.grantedBy}</b> on {OKAFOR.granted}. She can revoke it at any time from her own settings; no approval is needed. Nothing on this page can be changed from here.
          </div>
        </div>
        <Link href="/testing/advisor/compliance" className="adv-btn quiet">Consent record</Link>
      </div>

      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">Household · check-in Thursday Aug 27, 10:00</div>
          <h1 className="adv-h1">{OKAFOR.name}</h1>
          <p className="adv-lede">
            {singles.length} single names, {withReason.length} with a reason on file, {testedThisWeek.length} tested this week.
            NVDA is 18% of the household; the Schwab statements alone say 6%.
          </p>
        </div>
        <div className="adv-head-meta">
          <b>{usd(total, { compact: true })}</b> across {OKAFOR.accounts.length} accounts<br />
          Under management <b>{pct(managedValue / total, 0)}</b> · taxable <b>{pct(taxable / total, 0)}</b><br />
          Synced 06:12 · prices 06:20
        </div>
      </div>

      <div className="adv-cols">
        <div>
          {/* ── accounts, grouped by who runs them ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Accounts</span>
              <small>where you can trade, and where a harvest counts</small>
            </div>
            {groups.map((g) => (
              <div key={g.key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                  <span className="adv-h2" style={{ fontSize: 18 }}>{g.title}</span>
                  <small style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                    {usd(g.accounts.reduce((s, a) => s + a.value, 0), { compact: true })} · {pct(g.accounts.reduce((s, a) => s + a.value, 0) / total, 0)} of the household
                  </small>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 8 }}>{g.sub}</div>
                <table className="adv-table">
                  <thead>
                    <tr><th>Account</th><th>Source</th><th className="opt">Tax</th><th className="num">Value</th><th className="num opt">Share</th><th className="num opt">Last sync</th></tr>
                  </thead>
                  <tbody>
                    {g.accounts.map((a) => (
                      <tr key={a.name}>
                        <td className="name">{a.name}</td>
                        <td><span className={`adv-chip ${a.custody === 'linked' ? 'held' : ''}`}>{a.custody === 'linked' ? 'client-linked' : 'under management'}</span></td>
                        <td className="opt"><span className={`adv-chip ${a.tax === 'retirement' ? 'ret' : ''}`}>{a.tax}</span></td>
                        <td className="num">{usd(a.value)}</td>
                        <td className="num opt">{pct(a.value / total, 0)}</td>
                        <td className="num dim opt">{a.synced}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          {/* ── the reason register ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Every position, and why it is owned</span>
              <small>{withReason.length} of {singles.length} single names have a written reason · three funds need none</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Ticker</th><th className="opt">Where</th><th className="num">Value</th><th className="num opt">Household</th><th>Against the plan</th><th>The reason on file</th><th className="opt">The rule</th></tr>
              </thead>
              <tbody>
                {OKAFOR.positions.map((p) => {
                  const t = REASON_LABEL[p.thesis];
                  return (
                    <tr key={p.ticker}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                        {p.ticker}
                        <span className="sub" style={{ fontFamily: 'var(--sans)', fontWeight: 400 }}>{p.name}</span>
                      </td>
                      <td className="dim opt" style={{ fontSize: 12.5, maxWidth: 150 }}>
                        {p.account}
                        {p.source !== 'managed' && (
                          <span className="sub" style={{ color: 'var(--mark-ink)' }}>
                            {p.source === 'linked' ? 'client-linked' : 'both'}
                          </span>
                        )}
                      </td>
                      <td className="num">{usd(p.value)}</td>
                      <td className="num opt">{pct(p.weight, 1)}</td>
                      <td style={{ minWidth: 140 }}>
                        <span className={`adv-mark ${t.cls}`} />{t.text}
                        {p.lastTest && <span className="sub" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{p.lastTest.doc}</span>}
                      </td>
                      <td style={{ fontSize: 13, maxWidth: 300, color: p.reason && p.reason !== 'index' ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                        {p.reason === 'index' ? (
                          'Index fund, no reason needed.'
                        ) : p.reason === null ? (
                          <b style={{ color: 'var(--mark-ink)', fontWeight: 600 }}>No reason on file.</b>
                        ) : (
                          p.reason
                        )}
                      </td>
                      <td className="opt" style={{ fontSize: 12.5, color: RULES[p.ticker] ? 'var(--ink)' : 'var(--ink-3)', maxWidth: 210 }}>
                        {RULES[p.ticker] ?? (p.reason === 'index' ? 'Core allocation.' : 'No rule set.')}
                        {p.ticker === 'NVDA' && <span className="sub adv-neg">At 18.2% the household is past its own limit.</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
              {singles.filter((p) => p.reason === null).length} names carry no reason on file: {singles.filter((p) => p.reason === null).map((p) => p.ticker).join(', ')}. Four of them arrived
              in a 2019 transfer from the previous adviser and have never been discussed. The legacy note asks about those four.
            </div>
          </section>

          {/* ── harvest ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Harvestable losses · taxable accounts only</span>
              <small>{usd(OKAFOR.excludedRetirement, { compact: true })} in retirement accounts not counted</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Ticker</th><th className="opt">Account</th><th className="num">Unrealized loss</th><th>Wash-sale window</th></tr>
              </thead>
              <tbody>
                {OKAFOR.harvest.map((h) => (
                  <tr key={h.ticker}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{h.ticker}</td>
                    <td className="dim opt">{h.account}</td>
                    <td className="num adv-neg">{usd(h.loss)}</td>
                    <td style={{ fontSize: 12.5 }}>{h.wash}</td>
                  </tr>
                ))}
                <tr>
                  <td className="name">Realized if sold</td>
                  <td className="opt" />
                  <td className="num adv-neg" style={{ fontWeight: 600 }}>{usd(harvestTotal)}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>Tax effect depends on the household&rsquo;s return. Not estimated here.</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-3)' }}>
              Computed from average cost across each position, which is what the custodian reports through the link. Helm does not
              see individual purchases, so choose the shares to sell with your custodian, not from this screen.
            </div>
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="adv-rail">
          <div className="adv-eyebrow">Concentration</div>
          <div className="adv-stat">
            <div className="adv-stat-n">NVDA <small>18.2%</small></div>
            <div className="adv-stat-l">Across three accounts. <b>6.1%</b> in the accounts you manage, <b>12.1%</b> in the 401(k) and Robinhood. Your custodian statements show only the first.</div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: '6.1%' }} /><i className="held" style={{ left: '6.1%', width: '12.1%' }} /><b style={{ left: '20%' }} />
            </div>
          </div>

          <div className="adv-stat">
            <div className="adv-stat-n">{withReason.length} <small>of {singles.length}</small></div>
            <div className="adv-stat-l">
              Single names with a written reason. The {singles.length - withReason.length} without are {pct(singles.filter((p) => p.reason === null).reduce((s, p) => s + p.value, 0) / total, 0)} of
              the household, small enough to have fallen out of every review since the transfer.
            </div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: pct(withReason.length / singles.length, 0) }} />
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Next steps · drafted for the check-in</div>
          <div className="adv-stat">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              {OKAFOR.nextSteps.map((s) => <li key={s} style={{ marginBottom: 8 }}>{s}</li>)}
            </ol>
            <div style={{ marginTop: 10 }}>
              <Link href="/testing/advisor/note" className="adv-btn fill">Open the drafts</Link>
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Maintenance</div>
          <div className="adv-stat">
            <div className="adv-stat-l">
              Beneficiary on the Fidelity 401(k): <b>not in view</b> (plan data does not include it)<br />
              RMD: not applicable until 2041<br />
              Last check-in: Apr 9 · <b>next Thursday</b>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
