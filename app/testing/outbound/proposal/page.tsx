// /testing/outbound/proposal: Helm Outbound set as an engagement letter from
// an established regional firm. Warm paper, ink, one forest green; Source
// Serif 4 for display and Public Sans for reading. Every visible string comes
// from components/outbound/copy.ts, rendered verbatim.

import { Fragment } from 'react';
import Link from 'next/link';
import { Source_Serif_4, Public_Sans } from 'next/font/google';
import {
  AUTOMATION,
  BRAND,
  FOOTER,
  HERO,
  LEGAL_LINKS,
  PROSPECTING,
  QUESTIONS,
  WHO,
} from '@/components/outbound/copy';
import styles from './page.module.css';

const serif = Source_Serif_4({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--proposal-serif',
  display: 'swap',
});

const sans = Public_Sans({
  subsets: ['latin'],
  variable: '--proposal-sans',
  display: 'swap',
});

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

// Typesetting only; the characters are unchanged. Dollar amounts get their
// own class (tabular figures), and hyphenated words such as "20-minute" or
// "follow-ups" are kept whole so a line never breaks at the hyphen.
function set(text: string, figureClass?: string) {
  return text.split(/(\$\d[\d,]*|[\w’]+(?:-[\w’]+)+)/).map((part, i) => {
    if (figureClass && /^\$\d/.test(part)) {
      return (
        <span key={i} className={figureClass}>
          {part}
        </span>
      );
    }
    if (/^[\w’]+(?:-[\w’]+)+$/.test(part)) {
      return (
        <span key={i} className={styles.nowrap}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// Splits "A · B" so each part stays on one line and the separator never
// starts a line. The rendered text is identical to the source string.
function Separated({ text }: { text: string }) {
  const parts = text.split(' · ');
  return parts.map((part, i) => {
    const last = i === parts.length - 1;
    return (
      <Fragment key={part}>
        <span className={styles.nowrap}>
          {part}
          {!last && <span className={styles.dot}> ·</span>}
        </span>
        {!last && ' '}
      </Fragment>
    );
  });
}

function Arrow() {
  return (
    <svg className={styles.arrow} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d="M2.5 9h12M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Clause({ heading, items, id }: { heading: string; items: string[]; id: string }) {
  return (
    <div className={styles.clause}>
      <h3 id={id} className={styles.clauseHeading}>
        {heading}
      </h3>
      <ol className={styles.clauseList} role="list" aria-labelledby={id}>
        {items.map((item) => (
          <li key={item} className={styles.clauseItem}>
            <span>{set(item, styles.figure)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <div className={`${serif.variable} ${sans.variable} ${styles.root}`}>
      <header className={styles.letterhead}>
        <div className={styles.container}>
          <div className={styles.letterheadRow}>
            <p className={styles.wordmark}>{BRAND.wordmark}</p>
            <a className={styles.headerLink} href={HERO.secondary.href} {...NEW_TAB}>
              {HERO.secondary.label}
            </a>
          </div>
          <div className={styles.oxfordTop} aria-hidden="true" />
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="proposal-hero">
          <div className={`${styles.container} ${styles.heroInner}`}>
            <p className={styles.eyebrow}>
              <Separated text={HERO.eyebrow} />
            </p>
            <h1 id="proposal-hero" className={styles.headline}>
              {HERO.headline}
            </h1>
            <p className={styles.subhead}>{set(HERO.subhead)}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href={HERO.primary.href}>
                {HERO.primary.label}
              </a>
              <a className={styles.secondary} href={HERO.secondary.href} {...NEW_TAB}>
                <span className={styles.secondaryText}>{HERO.secondary.label}</span>
                <Arrow />
              </a>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="proposal-who">
          <div className={styles.container}>
            <div className={`${styles.ruled} ${styles.sideGrid}`}>
              <h2 id="proposal-who" className={styles.label}>
                {WHO.heading}
              </h2>
              <p className={`${styles.sideMain} ${styles.statement}`}>{set(WHO.body)}</p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="proposal-prospecting">
          <div className={styles.container}>
            <div className={styles.ruled}>
              <h2 id="proposal-prospecting" className={styles.heading}>
                {PROSPECTING.heading}
              </h2>
              <ol className={styles.steps} role="list">
                {PROSPECTING.steps.map((step, i) => (
                  <li key={step.lead} className={styles.step}>
                    <span className={styles.stepNumeral} aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <p className={styles.stepLead}>{step.lead}</p>
                      <p className={styles.stepBody}>{set(step.body)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className={styles.band}>
            <div className={styles.container}>
              <div className={styles.clauses}>
                <Clause id="proposal-sample" heading={PROSPECTING.sample.heading} items={PROSPECTING.sample.items} />
                <Clause id="proposal-pilot" heading={PROSPECTING.pilot.heading} items={PROSPECTING.pilot.items} />
              </div>
              <p className={styles.after}>{set(PROSPECTING.after, styles.afterFigure)}</p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="proposal-automation">
          <div className={styles.container}>
            <div className={`${styles.ruled} ${styles.sideGrid}`}>
              <h2 id="proposal-automation" className={styles.heading}>
                {AUTOMATION.heading}
              </h2>
              <p className={`${styles.sideMain} ${styles.lede}`}>{AUTOMATION.intro}</p>
            </div>
            <dl className={styles.defs}>
              {AUTOMATION.items.map((item) => (
                <div key={item.label} className={`${styles.sideGrid} ${styles.defRow}`}>
                  <dt className={styles.term}>{item.label}:</dt>
                  <dd className={`${styles.sideMain} ${styles.definition}`}>{set(item.body)}</dd>
                </div>
              ))}
            </dl>
            <div className={styles.sideGrid}>
              <p className={`${styles.sideMain} ${styles.closing}`}>{set(AUTOMATION.closing)}</p>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="proposal-questions">
          <div className={styles.container}>
            <div className={`${styles.ruled} ${styles.sideGrid}`}>
              <h2 id="proposal-questions" className={styles.heading}>
                {QUESTIONS.heading}
              </h2>
              <ul className={`${styles.sideMain} ${styles.faq}`} role="list">
                {QUESTIONS.items.map((item) => (
                  <li key={item.q} className={styles.faqItem}>
                    <h3 className={styles.question}>{item.q}</h3>
                    <p className={styles.answer}>{set(item.a)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.oxfordBottom} aria-hidden="true" />
          <div className={styles.footerRow}>
            <address className={styles.address}>
              <span className={styles.addressPart}>{FOOTER.company}</span>
              <span className={styles.footerDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.addressPart}>{FOOTER.address}</span>
              <span className={styles.footerDot} aria-hidden="true">
                ·
              </span>
              <a className={styles.footerLink} href={`mailto:${FOOTER.email}`}>
                {FOOTER.email}
              </a>
            </address>
            <ul className={styles.legal} role="list">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link className={styles.footerLink} href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
