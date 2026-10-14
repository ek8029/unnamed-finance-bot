// /outbound: Helm Outbound, the managed outbound prospecting and workflow
// automation service. Client facing, so it carries its own look rather than
// Helm Terminal's: a dawn sky drawn in CSS (no photography), one grotesk at
// modest sizes, and the service shown as the things a client gets (a target,
// a researched prospect, a draft for review). Excluded from PlatformSurface,
// and it renders its own cookie notice. Copy lives in
// components/outbound/copy.ts; change wording there, not here.

import type { Metadata } from 'next';
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
  SAMPLE_FORM,
  WHO,
} from '@/components/outbound/copy';
import { OutboundCookieNotice } from '@/components/outbound/cookie-notice';
import { DraftCard, ProspectCard, TargetCard } from './cards';
import { SampleForm } from './sample-form';
import styles from './page.module.css';

const grotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outbound',
});

const PAGE_URL = 'https://helmterminal.dev/outbound';

// The page sets its own openGraph and twitter blocks: without them the share
// card would carry the root layout's Helm Terminal title. The image comes from
// ./opengraph-image.tsx.
export const metadata: Metadata = {
  title: OUTBOUND_META.title,
  description: OUTBOUND_META.description,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: OUTBOUND_META.title,
    description: OUTBOUND_META.description,
    url: PAGE_URL,
    siteName: 'Helm Outbound',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: OUTBOUND_META.title,
    description: OUTBOUND_META.description,
  },
};

const CALL_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;

function splitAtColon(text: string): [string, string] {
  const i = text.indexOf(': ');
  return i === -1 ? [text, ''] : [text.slice(0, i + 1), text.slice(i + 2)];
}

// Keeps "$1,000" and "20-minute" on one line. Text unchanged.
function Nowrap({ text }: { text: string }) {
  const parts = text.split(/(\$[\d,]+|\d+-[a-z]+)/);
  return (
    <>
      {parts.map((part, i) =>
        /^(\$[\d,]+|\d+-[a-z]+)$/.test(part) ? (
          <span key={i} className={styles.nowrap}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// The Helm mark (same geometry as public/favicon.svg), one color so it takes
// the ink of wherever it sits.
function HelmMark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
      <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="28" y1="7" x2="28" y2="49" stroke="currentColor" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
      <line x1="7" y1="28" x2="49" y2="28" stroke="currentColor" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
      <circle cx="28" cy="28" r="9" fill="currentColor" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PrimaryButton({ tone = 'ink' }: { tone?: 'ink' | 'light' }) {
  return (
    <a className={`${styles.btn} ${tone === 'light' ? styles.btnLight : styles.btnInk}`} href={HERO.primary.href}>
      {HERO.primary.label}
      <Arrow />
    </a>
  );
}

function SecondaryButton({ tone = 'ink' }: { tone?: 'ink' | 'light' }) {
  return (
    <a
      className={`${styles.btn} ${tone === 'light' ? styles.btnGhostLight : styles.btnGhost}`}
      href={HERO.secondary.href}
      {...CALL_LINK}
    >
      {HERO.secondary.label}
    </a>
  );
}

function PilotItem({ text }: { text: string }) {
  const cut = text.indexOf('. ');
  if (text.startsWith('$') && cut !== -1) {
    return (
      <li className={styles.priceItem}>
        <span className={styles.price}>
          <Nowrap text={text.slice(0, cut + 1)} />
        </span>
        <span className={styles.priceNote}>
          <Nowrap text={text.slice(cut + 2)} />
        </span>
      </li>
    );
  }
  return <li className={styles.check}>{text}</li>;
}

export default function OutboundPage() {
  const [whoLead, whoRest] = splitAtColon(WHO.body);
  const [prospectLead, prospectRest] = splitAtColon(PROSPECTING.heading);

  return (
    <div className={`${grotesk.variable} ${styles.root}`}>
      <section className={styles.hero} aria-labelledby="ob-hero">
        <div className={styles.heroSky} aria-hidden="true" />
        <header className={`${styles.wrap} ${styles.header}`}>
          <p className={styles.wordmark}>
            <HelmMark className={styles.mark} />
            {BRAND.wordmark}
          </p>
          <a className={styles.headerCall} href={HERO.secondary.href} {...CALL_LINK}>
            {HERO.secondary.label}
          </a>
        </header>
        <div className={`${styles.wrap} ${styles.heroCopy}`}>
          <p className={styles.heroNote}>{HERO.eyebrow}</p>
          <h1 id="ob-hero" className={styles.h1}>
            {HERO.headline}
          </h1>
          <p className={styles.subhead}>{HERO.subhead}</p>
          <div className={styles.heroActions}>
            <PrimaryButton />
            <SecondaryButton />
          </div>
        </div>
      </section>

      <main id="main-content">
        <section className={`${styles.wrap} ${styles.who}`} aria-labelledby="ob-who">
          <h2 id="ob-who" className={styles.kicker}>
            {WHO.heading}
          </h2>
          <p className={styles.statement}>
            {whoLead}
            {whoRest && (
              <>
                {' '}
                <span className={styles.soft}>{whoRest}</span>
              </>
            )}
          </p>
        </section>

        <section className={`${styles.wrap} ${styles.section} ${styles.how}`} aria-labelledby="ob-how">
          <div className={styles.howText}>
            <h2 id="ob-how" className={styles.h2}>
              {prospectLead} <span className={styles.soft}>{prospectRest}</span>
            </h2>
            <ol>
              {PROSPECTING.steps.map((step, i) => (
                <li key={step.lead} className={styles.step}>
                  <span className={styles.stepIndex} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className={styles.stepLead}>{step.lead}</h3>
                    <p className={styles.stepBody}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.stage} aria-hidden="true">
            <TargetCard />
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.offerSection}`} aria-label={`${PROSPECTING.sample.heading} and ${PROSPECTING.pilot.heading}`}>
          <div className={styles.offers}>
            <div className={`${styles.offer} ${styles.offerSample}`}>
              <h3 className={styles.offerHead}>{PROSPECTING.sample.heading}</h3>
              <ul className={styles.checks}>
                {PROSPECTING.sample.items.map((item) => (
                  <li key={item} className={styles.check}>
                    {item}
                  </li>
                ))}
              </ul>
              <div className={styles.offerAction}>
                <PrimaryButton />
              </div>
            </div>
            <div className={`${styles.stage} ${styles.sampleStage}`} aria-hidden="true">
              <ProspectCard />
            </div>
            <div className={`${styles.offer} ${styles.offerPilot}`}>
              <h3 className={styles.offerHead}>{PROSPECTING.pilot.heading}</h3>
              <ul className={styles.checks}>
                {PROSPECTING.pilot.items.map((item) => (
                  <PilotItem key={item} text={item} />
                ))}
              </ul>
            </div>
          </div>
          <p className={styles.after}>
            <Nowrap text={PROSPECTING.after} />
          </p>
        </section>

        <section
          id={SAMPLE_FORM.id}
          className={`${styles.wrap} ${styles.section} ${styles.sampleSection}`}
          aria-labelledby="ob-sample"
        >
          <div>
            <h2 id="ob-sample" className={styles.h2}>
              {SAMPLE_FORM.heading}
            </h2>
            <p className={styles.lede}>{SAMPLE_FORM.intro}</p>
          </div>
          <div className={styles.formStage}>
            <SampleForm />
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section} ${styles.auto}`} aria-labelledby="ob-auto">
          <div>
            <h2 id="ob-auto" className={styles.h2}>
              {AUTOMATION.heading}
            </h2>
            <p className={styles.lede}>{AUTOMATION.intro}</p>
            <ul className={styles.autoList}>
              {AUTOMATION.items.map((item) => (
                <li key={item.label} className={styles.autoItem}>
                  <span className={styles.autoLabel}>{item.label}:</span> {item.body}
                </li>
              ))}
            </ul>
            <p className={styles.closing}>
              <Nowrap text={AUTOMATION.closing} />
            </p>
          </div>
          <div className={`${styles.stage} ${styles.autoStage}`} aria-hidden="true">
            <DraftCard />
          </div>
        </section>

        <section className={`${styles.narrow} ${styles.section}`} aria-labelledby="ob-q">
          <h2 id="ob-q" className={`${styles.h2} ${styles.center}`}>
            {QUESTIONS.heading}
          </h2>
          <div className={styles.qList}>
            {QUESTIONS.items.map((item, i) => (
              <details key={item.q} className={styles.qItem} open={i === 0}>
                <summary className={styles.summary}>
                  <span className={styles.qHead}>{item.q}</span>
                  <span className={styles.plus} aria-hidden="true" />
                </summary>
                <p className={styles.answer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <div className={styles.footTop}>
            <p className={styles.footMark}>
              <HelmMark className={styles.footMarkIcon} />
              {BRAND.wordmark}
            </p>
            <div className={styles.heroActions}>
              <PrimaryButton tone="light" />
              <SecondaryButton tone="light" />
            </div>
          </div>
          <div className={styles.footBottom}>
            <address className={styles.contact}>
              <span className={styles.company}>{FOOTER.company}</span>
              <span>{FOOTER.address}</span>
              <a className={styles.footLink} href={`mailto:${FOOTER.email}`}>
                {FOOTER.email}
              </a>
            </address>
            <ul className={styles.legal}>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link className={styles.footLink} href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
      <OutboundCookieNotice />
    </div>
  );
}
