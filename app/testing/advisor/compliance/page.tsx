// 05 · Compliance. The CCO's view. Not one position on the page, by design.
//
// Consent register, access log, vendor file, books-and-records export. This is
// the diligence pack a 1-10 person RIA files under 204-2(a)(25), answered
// honestly: SOC 2 is listed as not held rather than implied.

import { ACCESS_LOG, CONSENT_LOG, FIRM, VENDOR_FILE } from '../_data';

export default function AdvisorCompliance() {
  return (
    <main className="adv-page">
      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">Compliance · {FIRM.cco}, CCO · {FIRM.name}</div>
          <h1 className="adv-h1">
            Who saw what, <em>and the file that says so</em>
          </h1>
          <p className="adv-lede">
            This role sees consent, access and documents. It does not see a single position, balance or thesis, so the
            person who has to answer an examiner can do the job without touching client data.
          </p>
        </div>
        <div className="adv-head-meta">
          Grants <b>37</b> active · 1 pending · 1 revoked<br />
          Access events, 7 days: <b>412</b><br />
          Last export: Aug 25 16:20 · D. Ruiz
        </div>
      </div>

      <div className="adv-cols">
        <div>
          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Consent register</span>
              <small>the accepted tuple is the artifact · 6 of 39 shown</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Client</th><th>Granted</th><th>IP</th><th>Agent</th><th>Status</th></tr>
              </thead>
              <tbody>
                {CONSENT_LOG.map((c) => (
                  <tr key={c.client + c.granted}>
                    <td className="name">{c.client}</td>
                    <td className="dim" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.granted}</td>
                    <td className="dim" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.ip}</td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{c.agent}</td>
                    <td>
                      <span className={`adv-chip ${c.status.startsWith('revoked') ? 'neg' : c.status === 'pending' ? 'ret' : ''}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Access log</span>
              <small>every read of client data by a person writes a row · semantic, not row-level</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>When</th><th>Who</th><th>Role</th><th>Action</th><th>Subject</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {ACCESS_LOG.map((a, i) => (
                  <tr key={i} className={a.role === 'system' ? 'row-quiet' : ''}>
                    <td className="dim" style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }}>{a.at}</td>
                    <td className="name">{a.who}</td>
                    <td><span className="adv-chip">{a.role}</span></td>
                    <td>{a.action}</td>
                    <td>{a.subject}</td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="adv-section">
            <div className="adv-section-head">
              <span className="adv-eyebrow">Vendor file · Helm</span>
              <small>what your diligence record holds on us</small>
            </div>
            <table className="adv-table">
              <thead>
                <tr><th>Document</th><th>Status</th><th>Note</th></tr>
              </thead>
              <tbody>
                {VENDOR_FILE.map((v) => (
                  <tr key={v.doc}>
                    <td className="name" style={{ maxWidth: 260 }}>{v.doc}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'nowrap' }} className={v.status === 'Not held' ? 'adv-neg' : ''}>{v.status}</td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{v.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="adv-rail">
          <div className="adv-eyebrow">Books and records</div>
          <div className="adv-stat">
            <div className="adv-stat-l">
              One dated bundle: clients, households, grants with consent timestamps, per-client holdings and
              transactions, every thesis with each cited document and its retrieval time, the access log for the period,
              and a manifest with a SHA-256 per file.
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" className="adv-btn fill">Export · Aug 1 to Aug 26</button>
            </div>
            <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Format agreed with your archive. Retention is yours: five years, first two on site, per 204-2(e)(1).
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Breach notice</div>
          <div className="adv-stat">
            <div className="adv-stat-l">
              Helm notifies this firm within <b>72 hours</b> of becoming aware of unauthorized access to a system it
              maintains. Your 30-day client clock starts with ours. No incidents on record.
            </div>
          </div>

          <div className="adv-eyebrow" style={{ marginTop: 22 }}>Roles</div>
          <div className="adv-stat">
            <table className="adv-table" style={{ fontSize: 12.5 }}>
              <tbody>
                <tr><td className="name">Owner</td><td className="dim">everything</td></tr>
                <tr><td className="name">Advisor</td><td className="dim">assigned households</td></tr>
                <tr><td className="name">Operations</td><td className="dim">all, read-only</td></tr>
                <tr><td className="name">Compliance</td><td className="dim">audit and export, no positions</td></tr>
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </main>
  );
}
