import Link from 'next/link';
import { THEMES } from './themes';

const SCREENS = [
  {
    no: '01',
    href: '/testing/advisor/book',
    name: 'The book, 7:40 AM',
    body: 'One screen per morning. What needs you overnight, then the same book cut two ways: by household, the way the calendar is organised, and by name, the way the risk sits. Twenty-seven rows say nothing changed, on purpose.',
    why: 'Every single name across the firm, under management and client-linked alike, with a reason on file or without one',
  },
  {
    no: '02',
    href: '/testing/advisor/client',
    name: 'One household',
    body: 'Accounts under management above accounts the client runs, taxable beside retirement, and beside each single name the written reason for owning it, or nothing, which is the finding. Read-only, revocable, and it says so.',
    why: 'Fourteen single names, nine reasons on file, three tested this week',
  },
  {
    no: '03',
    href: '/testing/advisor/note',
    name: 'The notes',
    body: 'Two kinds, both one page in the advisor’s voice. The event note: what changed, what the filing said, what it means for the rule, what we are doing. The legacy review: the names with nothing written down, and a question for the client.',
    why: 'Nothing a Marketing Rule reviewer would strike, and the rail shows what was struck',
  },
  {
    no: '04',
    href: '/testing/advisor/digest',
    name: 'The digest',
    body: 'Monday 6:45 AM. Numbers, then the names a document tested last week with the sentence quoted, then what reports in the next seven days, then the three things that need a person. Quiet week, one line.',
    why: 'The email is the habit; the book gets opened when the email says something happened',
  },
  {
    no: '05',
    href: '/testing/advisor/consent',
    name: 'Consent',
    body: 'The client’s screen. That the advisor sees the accounts they link, the ones the firm already manages and the ones they run themselves, what the advisor never sees, and that revoking is one click with no approval.',
    why: 'Advisor invites, client accepts, revocation is instant and needs nobody',
  },
  {
    no: '06',
    href: '/testing/advisor/compliance',
    name: 'Compliance',
    body: 'The CCO’s view: consent register, access log, data provenance, vendor file, export. Not one position on the page. Two sources feed everything, each with what it never provides written next to what it does.',
    why: 'The diligence pack a small firm actually asks for, answered honestly, SOC 2 included',
  },
  {
    no: '07',
    href: '/testing/advisor/precall',
    name: 'Before the first call',
    body: 'What a prospect firm gets before anything is shared: its own 13F-HR sorted into funds and companies, the eight largest companies with the sentence from each latest filing that tests them, and what a 13F cannot see.',
    why: 'Nothing signed, nothing shared, nothing the firm had not already published',
  },
];

export default function AdvisorLabIndex() {
  return (
    <main className="adv-page">
      <div className="adv-head">
        <div>
          <div className="adv-eyebrow">Larkspur Wealth Partners · Sarah Whitcomb</div>
          <h1 className="adv-h1">
            Helm for advisors, <em>seven screens, six palettes</em>
          </h1>
          <p className="adv-lede">
            Vendor to a 5 to 15 person RIA. Read-only, evidence-first, never trades. One premise: every single name across
            the firm&rsquo;s book, in the accounts the firm manages and the accounts the clients run, each with a written
            reason, checked every market day against what the companies file. Pick a palette in the strip; it follows you
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
