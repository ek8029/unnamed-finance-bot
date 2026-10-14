// /testing/outbound/worksheet: "Work order" variant of the Helm Outbound page.
// The page reads as one printed job sheet: ruled cells, form-field labels,
// drawn check boxes, condensed headings and one hi-vis orange. Every visible
// string comes from components/outbound/copy.ts except the specimen record
// below, whose strings were supplied with the brief.

import { Archivo, IBM_Plex_Mono } from 'next/font/google';
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
import s from './page.module.css';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--wo-font-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: '500',
  display: 'swap',
  variable: '--wo-font-mono',
});

// One prospect as it would appear in the free sample, with placeholders only.
const SPECIMEN = {
  label: 'Example of one prospect in the sample',
  note: 'Illustration only. Not a real business or person.',
  fields: [
    { label: 'Prospect', value: '[Business name]' },
    { label: 'Why it fits', value: '[Reason from a permit, license or property sale]' },
    { label: 'Source', value: '[Public record and date]' },
    { label: 'Named contact', value: '[Owner or manager name, title]' },
    { label: 'Where the name was published', value: '[Page where the name appears]' },
    { label: 'Drafted email', value: '[Email in your name, for your approval]' },
  ],
};

// Sets each "$1,000" in bold tabular figures without changing the words.
function withPrice(text: string) {
  return text.split(/(\$1,000)/).map((part, i) =>
    part === '$1,000' ? (
      <strong key={i} className={s.price}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function SectionHead({ num, id, title }: { num: string; id: string; title: string }) {
  return (
    <div className={s.sectionHead}>
      <div className={s.sectionHeadInner}>
        <span className={s.num} aria-hidden="true">
          {num}
        </span>
        <h2 id={id} className={s.h2}>
          {title}
        </h2>
      </div>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className={s.checks}>
      {items.map((item) => (
        <li key={item}>{withPrice(item)}</li>
      ))}
    </ul>
  );
}

export default function WorkOrderPage() {
  return (
    <div className={`${archivo.variable} ${plexMono.variable} ${s.root}`}>
      <div className={s.sheet}>
        <header className={s.header}>
          <p className={s.wordmark}>{BRAND.wordmark}</p>
          <a
            className={s.headerLink}
            href={HERO.secondary.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {HERO.secondary.label}
          </a>
        </header>

        <main>
          <section className={s.hero} aria-labelledby="wo-title">
            <div className={s.heroMain}>
              <p className={s.strip}>{HERO.eyebrow}</p>
              <div className={s.heroBody}>
                <h1 id="wo-title" className={s.h1}>
                  {HERO.headline}
                </h1>
                <p className={s.subhead}>{HERO.subhead}</p>
                <div className={s.actions}>
                  <a className={`${s.btn} ${s.btnPrimary}`} href={HERO.primary.href}>
                    {HERO.primary.label}
                  </a>
                  <a
                    className={`${s.btn} ${s.btnSecondary}`}
                    href={HERO.secondary.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {HERO.secondary.label}
                  </a>
                </div>
              </div>
            </div>

            <figure className={s.specimen} aria-labelledby="wo-specimen">
              <p id="wo-specimen" className={`${s.strip} ${s.stripInk}`}>
                {SPECIMEN.label}
              </p>
              <dl className={s.fields}>
                {SPECIMEN.fields.map((f) => (
                  <div key={f.label} className={s.field}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <figcaption className={s.caption}>{SPECIMEN.note}</figcaption>
            </figure>
          </section>

          <section className={s.section} aria-labelledby="wo-who">
            <SectionHead num="01" id="wo-who" title={WHO.heading} />
            <div className={s.sectionBody}>
              <p className={s.lede}>{WHO.body}</p>
            </div>
          </section>

          <section className={s.section} aria-labelledby="wo-prospecting">
            <SectionHead num="02" id="wo-prospecting" title={PROSPECTING.heading} />
            <div className={s.sectionBody}>
              <ol className={s.steps}>
                {PROSPECTING.steps.map((step, i) => (
                  <li key={step.lead} className={s.step}>
                    <span className={s.stepNum} aria-hidden="true">
                      {i + 1}
                    </span>
                    <strong className={s.stepLead}>{step.lead}</strong>
                    <p className={s.stepBody}>{step.body}</p>
                  </li>
                ))}
              </ol>

              <div className={s.offer}>
                <div className={s.offerCell}>
                  <h3 className={s.h3}>{PROSPECTING.sample.heading}</h3>
                  <CheckList items={PROSPECTING.sample.items} />
                </div>
                <div className={s.offerCell}>
                  <h3 className={s.h3}>{PROSPECTING.pilot.heading}</h3>
                  <CheckList items={PROSPECTING.pilot.items} />
                </div>
              </div>

              <div className={s.note}>
                <p>{withPrice(PROSPECTING.after)}</p>
              </div>
            </div>
          </section>

          <section className={s.section} aria-labelledby="wo-automation">
            <SectionHead num="03" id="wo-automation" title={AUTOMATION.heading} />
            <div className={s.sectionBody}>
              <p className={s.intro}>{AUTOMATION.intro}</p>
              <ul className={s.rows}>
                {AUTOMATION.items.map((item) => (
                  <li key={item.label} className={s.row}>
                    <strong className={s.rowLabel}>{item.label}:</strong>{' '}
                    <span className={s.rowBody}>{item.body}</span>
                  </li>
                ))}
              </ul>
              <div className={s.note}>
                <p>{AUTOMATION.closing}</p>
              </div>
            </div>
          </section>

          <section className={s.section} aria-labelledby="wo-questions">
            <SectionHead num="04" id="wo-questions" title={QUESTIONS.heading} />
            <div className={s.sectionBody}>
              <ul className={s.qa}>
                {QUESTIONS.items.map((item) => (
                  <li key={item.q} className={s.qaItem}>
                    <h3 className={s.q}>{item.q}</h3>
                    <p className={s.a}>{item.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        <footer className={s.footer}>
          <address className={s.contact}>
            <span>{FOOTER.company}</span>
            <span className={s.sep} aria-hidden="true">
              ·
            </span>
            <span>{FOOTER.address}</span>
            <span className={s.sep} aria-hidden="true">
              ·
            </span>
            <a className={s.email} href={`mailto:${FOOTER.email}`}>
              {FOOTER.email}
            </a>
          </address>
          <nav className={s.legal} aria-label="Legal">
            <ul>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </footer>
      </div>
    </div>
  );
}
