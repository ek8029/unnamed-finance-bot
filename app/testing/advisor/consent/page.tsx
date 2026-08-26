// 04 · Consent. The client's screen, not the advisor's.
//
// Advisor invites, client accepts inside their own Helm account. The screen
// says in plain words what the advisor will see, what they never will, and
// that revoking is one click with no approval. The accepted tuple (time, IP,
// agent) is the consent artifact an examiner gets shown.

export default function AdvisorConsent() {
  return (
    <main className="adv-page">
      <div style={{ textAlign: 'center' }}>
        <div className="adv-eyebrow">Shown to the client · in their own account</div>
      </div>

      <div className="adv-consent">
        <div className="adv-eyebrow">Access request</div>
        <h1 className="adv-h2" style={{ marginTop: 6 }}>
          Sarah Whitcomb at Larkspur Wealth Partners is asking to see the accounts you link in Helm.
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          You choose which accounts to link. You can take this back at any time.
        </p>

        <ul className="adv-consent-list">
          <li><span className="k">will</span><span>See your holdings, transactions, cost basis and the reasons you have written down for owning things.</span></li>
          <li><span className="k">will</span><span>See when a filing or a news item tests one of those reasons, with the source quoted.</span></li>
          <li><span className="k no">never</span><span>See your login details. Helm never has them either; the link is read-only through Plaid.</span></li>
          <li><span className="k no">never</span><span>Trade, move money, or change anything in any account.</span></li>
          <li><span className="k no">never</span><span>Keep access after you revoke it. Revoking is one click in your settings and needs no approval.</span></li>
        </ul>

        <div className="adv-consent-actions">
          <button type="button" className="adv-btn fill">Allow</button>
          <button type="button" className="adv-btn quiet">Not now</button>
        </div>
        <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.06em', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Allowing records the time, your IP address and your browser as the record of consent.
          Larkspur is a client of Helm; Helm is not your adviser and gives no advice.
        </div>
      </div>

      {/* the revoke row, as it appears later in the client's settings */}
      <div style={{ maxWidth: 460, margin: '36px auto 0' }}>
        <div className="adv-eyebrow" style={{ marginBottom: 8 }}>Later, in the client&rsquo;s settings</div>
        <div style={{ borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--rule-2)', padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Larkspur Wealth Partners</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Read-only · granted Jul 14, 2026 · 4 accounts</div>
          </div>
          <button type="button" className="adv-btn quiet" style={{ borderColor: 'var(--neg)', color: 'var(--neg)' }}>Revoke access</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-3)' }}>
          Takes effect on the next page load, theirs and yours. They are told it happened, not asked.
        </div>
      </div>
    </main>
  );
}
