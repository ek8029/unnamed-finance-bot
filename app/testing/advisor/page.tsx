import Link from 'next/link';

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
    href: '/testing/advisor/consent',
    name: 'Consent',
    body: 'The client’s screen. What the advisor will see, what they never will, and that revoking is one click with no approval. The consent tuple is the artifact.',
    why: 'Spec §2.2 and §3.4 (advisor invites, client accepts, revocation instant)',
  },
  {
    no: '05',
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
          <div className="adv-eyebrow">Design lab · 2026-08-26</div>
          <h1 className="adv-h1">
            Helm for advisors, <em>five screens</em>
          </h1>
          <p className="adv-lede">
            Vendor to a 5 to 15 person RIA. Read-only, evidence-first, never trades. Built from the research in
            ria-research/SYNTHESIS.md rather than from the consumer terminal, so it is paper, ink and hairlines instead of
            black and gold. Every figure is sample data.
          </p>
        </div>
        <div className="adv-head-meta">
          Buyer: owner of a fee-only RIA<br />
          User: the advisor, then the CSA<br />
          Gate: the CCO, who sees no positions
        </div>
      </div>

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
