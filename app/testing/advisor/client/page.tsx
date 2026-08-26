// 02 · One household. The half the advisor cannot see, counted in.
//
// Custodied beside held-away, taxable beside retirement, and the reason the
// client owns each position beside the last document that tested it. The
// banner is not decoration: read-only and revocable is the legal lane.

import Link from 'next/link';
import { OKAFOR, pct, usd } from '../_data';

const THESIS_LABEL: Record<string, { text: string; cls: string }> = {
  contradicted: { text: 'Contradicted', cls: 'neg' },
  weakening: { text: 'Weakening', cls: '' },
  holds: { text: 'Holds', cls: 'pos' },
  index: { text: 'Index', cls: 'none' },
  none: { text: 'No thesis', cls: 'none' },
};

export default function AdvisorClient() {
  const total = OKAFOR.accounts.reduce((s, a) => s + a.value, 0);
  const custodied = OKAFOR.accounts.filter((a) => a.custody === 'custodied').reduce((s, a) => s + a.value, 0);
  const taxable = OKAFOR.accounts.filter((a) => a.tax === 'taxable').reduce((s, a) => s + a.value, 0);
  const harvestTotal = OKAFOR.harvest.reduce((s, h) => s + h.loss, 0);

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
            Four accounts, two of them where you cannot trade. NVDA is 18% of the household; the Schwab statements alone
            say 6%. One reason to own something was contradicted yesterday.
          </p>
        </div>
        <div className="adv-head-meta">
          <b>{usd(total, { compact: true })}</b> across 4 accounts<br />
          In your custody <b>{pct(custodied / total, 0)}</b> · taxable <b>{pct(taxable / total, 0)}</b><br />
          Synced 06:12 · prices 06:20
        </div>
      </div>

      <div className="adv-cols">
        <div>
          {/* ── accounts ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Accounts</span>
              <small>custody and tax status decide what you can do about anything below</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Account</th><th>Custody</th><th>Tax</th><th className="num">Value</th><th className="num">Share</th><th className="num">Synced</th></tr>
              </thead>
              <tbody>
                {OKAFOR.accounts.map((a) => (
                  <tr key={a.name}>
                    <td className="name">{a.name}</td>
                    <td><span className={`adv-chip ${a.custody === 'held-away' ? 'held' : ''}`}>{a.custody}</span></td>
                    <td><span className={`adv-chip ${a.tax === 'retirement' ? 'ret' : ''}`}>{a.tax}</span></td>
                    <td className="num">{usd(a.value)}</td>
                    <td className="num">{pct(a.value / total, 0)}</td>
                    <td className="num dim">{a.synced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── positions ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Positions and why they are held</span>
              <small>7 of 23 shown · thesis status is the last document that tested it</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Ticker</th><th>Where</th><th className="num">Value</th><th className="num">Household</th><th>Thesis</th><th>The reason, in the client&rsquo;s words</th></tr>
              </thead>
              <tbody>
                {OKAFOR.positions.map((p) => {
                  const t = THESIS_LABEL[p.thesis];
                  return (
                    <tr key={p.ticker}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{p.ticker}</td>
                      <td className="dim" style={{ fontSize: 12.5 }}>{p.account}</td>
                      <td className="num">{usd(p.value)}</td>
                      <td className="num">{pct(p.weight, 1)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`adv-mark ${t.cls}`} />{t.text}
                        {p.evidence && <span className="sub" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{p.evidence}</span>}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 360 }}>{p.why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* ── harvest ── */}
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Harvestable losses · taxable accounts only</span>
              <small>{usd(OKAFOR.excludedRetirement, { compact: true })} in retirement accounts excluded by construction</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Ticker</th><th>Account</th><th className="num">Lots</th><th className="num">Unrealized loss</th><th>Wash-sale window</th></tr>
              </thead>
              <tbody>
                {OKAFOR.harvest.map((h) => (
                  <tr key={h.ticker}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{h.ticker}</td>
                    <td className="dim">{h.account}</td>
                    <td className="num">{h.lots}</td>
                    <td className="num adv-neg">{usd(h.loss)}</td>
                    <td style={{ fontSize: 12.5 }}>{h.wash}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="name">Realized if sold</td>
                  <td className="num adv-neg" style={{ fontWeight: 600 }}>{usd(harvestTotal)}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>Tax effect depends on the household&rsquo;s return. Not estimated here.</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* ── rail ── */}
        <aside className="adv-rail">
          <div className="adv-eyebrow">Concentration</div>
          <div className="adv-stat">
            <div className="adv-stat-n">NVDA <small>18.2%</small></div>
            <div className="adv-stat-l">Across three accounts. <b>6.1%</b> in your custody, <b>12.1%</b> in Robinhood and the 401(k). Orion shows the first number.</div>
            <div className="adv-scale" style={{ marginTop: 8 }}>
              <i style={{ width: '6.1%' }} /><i className="held" style={{ left: '6.1%', width: '12.1%' }} /><b style={{ left: '20%' }} />
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Next steps · drafted for the check-in</div>
          <div className="adv-stat">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              {OKAFOR.nextSteps.map((s) => <li key={s} style={{ marginBottom: 8 }}>{s}</li>)}
            </ol>
            <div style={{ marginTop: 10 }}>
              <Link href="/testing/advisor/note" className="adv-btn fill">Open the NVDA note</Link>
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
