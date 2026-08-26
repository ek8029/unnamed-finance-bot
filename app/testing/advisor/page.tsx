import Link from 'next/link';
import { THEMES } from './theme-shell';

const SCREENS = [
  {
    no: '01',
    href: '/testing/advisor/book',
    name: 'The book, 7:40 AM',
    body: 'One screen per morning. What needs you overnight, then every household on a ledger with the half you cannot see counted in. Twenty-seven rows say nothing changed, on purpose.',
    why: 'Research 02 §2.5 (prep is the block), 03 §1.8 (somebody looked at our stuff), spec §2.3',
  },
  {
    no: '02',
    href: '/testing/advisor/client',
    name: 'One household',
    body: 'Custodied beside held-away, taxable beside retirement, and the reason the client owns each position next to the last document that tested it. Read-only, revocable, and it says so.',
    why: 'Research 03 §3.2 (87% self-manage), spec P0-B (taxable vs retirement), 01 §7.1 (view-only lane)',
  },
  {
    no: '03',
    href: '/testing/advisor/note',
    name: 'The note',
    body: 'One page in the advisor’s voice: what changed, what the filing said, what it means for the rule, what we are doing. April’s call revisited and graded. Nothing a Marketing Rule reviewer would strike.',
    why: 'Research 03 §5.4 (output spec), §2.10 (Edgemoor), §4.5 (hypothetical performance)',
  },
  {
    no: '04',
    href: '/testing/advisor/digest',
    name: 'The digest',
    body: 'Monday 6:45 AM. Numbers first, then the three things that need a person, then what went out last week. The email is the habit; the book gets opened when the email says something happened.',
    why: 'Spec §2.3 (digest creates the habit), research 03 §3.3 (16 to 20 touchpoints, 1 to 2 meetings)',
  },
  {
    no: '05',
    href: '/testing/advisor/consent',
    name: 'Consent',
    body: 'The client’s screen. What the advisor will see, what they never will, and that revoking is one click with no approval. The consent tuple is the artifact.',
    why: 'Spec §2.2 and §3.4 (advisor invites, client accepts, revocation instant)',
  },
  {
    no: '06',
    href: '/testing/advisor/compliance',
    name: 'Compliance',
    body: 'The CCO’s view: consent register, access log, vendor file, export. Not one position on the page. The diligence pack a small firm actually asks for, answered honestly, SOC 2 included.',
    why: 'Compliance readiness §1.2 (the 17 rows), spec §3.2 (compliance role sees no portfolio data)',
  },
];

export default function AdvisorLabIndex() {
  return (
    <main className="adv-page">
      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">Larkspur Wealth Partners · Sarah Whitcomb</div>
          <h1 className="adv-h1">
            Helm for advisors, <em>six screens, six palettes</em>
          </h1>
          <p className="adv-lede">
            Vendor to a 5 to 15 person RIA. Read-only, evidence-first, never trades. Built from the research in
            ria-research/SYNTHESIS.md rather than from the consumer terminal. Pick a palette in the strip; it follows you
            across every screen.
          </p>
        </div>
        <div className="adv-head-meta">
          Buyer: owner of a fee-only RIA<br />
          User: the advisor, then the CSA<br />
          Gate: the CCO, who sees no positions
        </div>
      </div>

      <section className="adv-section" style={{ borderBottom: 0 }}>
        <div className="adv-section-head">
          <span className="adv-eyebrow">Palettes</span>
          <small>three light, three dark · same layout, same copy</small>
        </div>
        <div className="adv-palettes">
          {THEMES.map((t) => (
            <div key={t.id} className="adv-palette">
              <div className="sw"><span className="adv-theme-btn" style={{ padding: 0, border: 0 }}><i data-swatch={t.id} style={{ width: 22, height: 22 }} /></span></div>
              <b>{t.name} <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--ink-3)' }}>{t.mode.toUpperCase()}</span></b>
              <p>{t.line}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="adv-index">
        {SCREENS.map((s) => (
          <Link key={s.href} href={s.href}>
            <span className="no">{s.no}</span>
            <span>
              <span className="adv-h2">{s.name}</span>
              <p>{s.body}</p>
              <span className="why">{s.why}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
