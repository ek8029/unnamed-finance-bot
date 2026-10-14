// /testing/outbound/firm: "Quiet firm" layout candidate for Helm Outbound.
// A contemporary professional-services page: one grotesk family, very large
// type, lots of air, a full-bleed navy band for the offer. Server component,
// no client JS. Every visible string comes from components/outbound/copy.

import Link from 'next/link';
import { Schibsted_Grotesk } from 'next/font/google';
import {
  AUTOMATION,
  BRAND,
  FOOTER,
  HERO,
  LEGAL_LINKS,
  OUTBOUND_META,
  PROSPECTING,
  QUESTIONS,
  WHO,
} from '@/components/outbound/copy';
import styles from './page.module.css';

const firm = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-firm',
});

export const metadata = {
  title: OUTBOUND_META.title,
  description: OUTBOUND_META.description,
  robots: { index: false, follow: false },
};

const CALL_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;

// Splits "Lead: rest" at the first colon so the lead can sit in ink and the
// rest in slate. The rendered text is unchanged.
function splitAtColon(text: string): [string, string] {
  const i = text.indexOf(': ');
  return i === -1 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 2)];
}

// Typesetting only, text unchanged:
// - "$1,000" gets tabular digits. Only the digit runs carry tnum, because this
//   font also has a tabular comma, which set "$1,000" as "$1 , 000".
// - "20-minute" style compounds never break at the hyphen.
function Figures({ text }: { text: string }) {
  const parts = text.split(/(\$[\d,]+|\d+-[a-z]+)/);
  return (
    <>
      {parts.map((part, i) => {
        if (/^\$[\d,]+$/.test(part)) {
          return (
            <span key={i} className={styles.figure}>
              {part.split(/(\d+)/).map((bit, j) =>
                /^\d+$/.test(bit) ? (
                  <span key={j} className={styles.tnum}>
                    {bit}
                  </span>
                ) : (
                  bit
                ),
              )}
            </span>
          );
        }
        if (/^\d+-[a-z]+$/.test(part)) {
          return (
            <span key={i} className={styles.nowrap}>
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 10h13M11 4.5 16.5 10 11 15.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function OfferItem({ text }: { text: string }) {
  // The pilot's price line leads with its figure: "$1,000 to start." is set
  // large, the condition follows at body size. Same words, same order.
  const cut = text.indexOf('. ');
  if (text.startsWith('$') && cut !== -1) {
    return (
      <li className={styles.offerItem}>
        <span className={styles.priceLead}>
          <Figures text={text.slice(0, cut + 1)} />
        </span>{' '}
        <span>
          <Figures text={text.slice(cut + 2)} />
        </span>
      </li>
    );
  }
  return (
    <li className={styles.offerItem}>
      <Figures text={text} />
    </li>
  );
}

export default function QuietFirmPage() {
  const [eyebrowOrg, ...eyebrowRest] = HERO.eyebrow.split(' · ');
  const [whoLead, whoRest] = splitAtColon(WHO.body);
  const [prospectLead, prospectRest] = splitAtColon(PROSPECTING.heading);

  return (
    <div className={`${firm.variable} ${styles.root}`}>
      <header className={styles.header}>
        <p className={styles.wordmark}>{BRAND.wordmark}</p>
        <a className={styles.headerLink} href={HERO.secondary.href} {...CALL_LINK}>
          {HERO.secondary.label}
        </a>
      </header>

      <main>
        <section className={`${styles.wrap} ${styles.hero}`} aria-labelledby="firm-hero">
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowOrg}>{eyebrowOrg}</span>
              {eyebrowRest.length > 0 && (
                <>
                  <span className={styles.eyebrowSep}>{' · '}</span>
                  {eyebrowRest.join(' · ')}
                </>
              )}
            </p>
            <h1 id="firm-hero" className={styles.h1}>
              {HERO.headline}
            </h1>
            <div className={styles.heroAside}>
              <p className={styles.subhead}>{HERO.subhead}</p>
              <div className={styles.actions}>
                <a className={`${styles.btn} ${styles.btnNavy}`} href={HERO.primary.href}>
                  {HERO.primary.label}
                </a>
                <a className={styles.textLink} href={HERO.secondary.href} {...CALL_LINK}>
                  <span className={styles.textLinkLabel}>{HERO.secondary.label}</span>
                  <Arrow />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.wrap} aria-labelledby="firm-who">
          <div className={styles.who}>
            <h2 id="firm-who" className={styles.whoHead}>
              {WHO.heading}
            </h2>
            <p className={styles.whoBody}>
              <span className={styles.ink}>{whoLead}</span>
              {whoRest && (
                <>
                  {' '}
                  {whoRest}
                </>
              )}
            </p>
          </div>
        </section>

        <section className={styles.prospecting} aria-labelledby="firm-prospecting">
          <div className={`${styles.wrap} ${styles.process}`}>
            <h2 id="firm-prospecting" className={styles.h2}>
              <span className={styles.ink}>{prospectLead}</span>
              {prospectRest && (
                <>
                  {' '}
                  <span className={styles.h2Soft}>{prospectRest}</span>
                </>
              )}
            </h2>
            <ol className={styles.steps}>
              {PROSPECTING.steps.map((step, i) => (
                <li key={step.lead} className={styles.step}>
                  <span className={styles.numeral} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepLead}>{step.lead}</h3>
                    <p className={styles.stepText}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.band}>
            <div className={styles.wrap}>
              <div className={styles.offers}>
                <div className={styles.offerSample}>
                  <h3 className={styles.offerHead}>{PROSPECTING.sample.heading}</h3>
                  <ul className={styles.offerList}>
                    {PROSPECTING.sample.items.map((item) => (
                      <OfferItem key={item} text={item} />
                    ))}
                  </ul>
                </div>
                <div className={styles.offerPilot}>
                  <h3 className={styles.offerHead}>{PROSPECTING.pilot.heading}</h3>
                  <ul className={styles.offerList}>
                    {PROSPECTING.pilot.items.map((item) => (
                      <OfferItem key={item} text={item} />
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.bandFoot}>
                <p className={styles.after}>
                  <Figures text={PROSPECTING.after} />
                </p>
                <a className={`${styles.btn} ${styles.btnSand}`} href={HERO.primary.href}>
                  {HERO.primary.label}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.automation}`} aria-labelledby="firm-automation">
          <h2 id="firm-automation" className={styles.h2}>
            {AUTOMATION.heading}
          </h2>
          <p className={styles.autoIntro}>{AUTOMATION.intro}</p>
          <ul className={styles.autoGrid}>
            {AUTOMATION.items.map((item) => (
              <li key={item.label} className={styles.autoItem}>
                <h3 className={styles.autoLabel}>{item.label}:</h3> <p className={styles.autoBody}>{item.body}</p>
              </li>
            ))}
          </ul>
          <p className={styles.autoClosing}>
            <Figures text={AUTOMATION.closing} />
          </p>
        </section>

        <section className={`${styles.wrap} ${styles.questions}`} aria-labelledby="firm-questions">
          <h2 id="firm-questions" className={`${styles.h2} ${styles.qTitle}`}>
            {QUESTIONS.heading}
          </h2>
          <div className={styles.qList}>
            {QUESTIONS.items.map((item, i) => (
              <details key={item.q} className={styles.qItem} open={i === 0}>
                <summary className={styles.summary}>
                  <h3 className={styles.qHead}>{item.q}</h3>
                  <span className={styles.mark} aria-hidden="true" />
                </summary>
                <p className={styles.answer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.footerGrid}`}>
          <address className={styles.contact}>
            <p className={styles.company}>{FOOTER.company}</p>
            <p className={styles.footLine}>{FOOTER.address}</p>
            <p className={styles.footLine}>
              <a className={styles.footEmail} href={`mailto:${FOOTER.email}`}>
                {FOOTER.email}
              </a>
            </p>
          </address>
          <ul className={styles.legal}>
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link className={styles.legalLink} href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
