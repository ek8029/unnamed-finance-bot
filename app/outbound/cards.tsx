// /outbound illustrations: the target, one researched prospect and an
// automation draft, drawn as interface. Decorative (rendered aria-hidden); the
// copy beside them carries the meaning. Wording comes from EXAMPLES in
// components/outbound/copy.ts.

import { EXAMPLES } from '@/components/outbound/copy';
import styles from './page.module.css';

function CardHead({ title }: { title: string }) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.tag}>{EXAMPLES.tag}</span>
    </div>
  );
}

export function TargetCard() {
  const t = EXAMPLES.target;
  return (
    <div className={styles.card}>
      <CardHead title={t.title} />
      <dl className={styles.fields}>
        {t.rows.map((row) => (
          <div key={row.label}>
            <dt className={styles.fieldLabel}>{row.label}</dt>
            <dd className={styles.fieldValue}>
              {'chips' in row && row.chips ? (
                <span className={styles.chips}>
                  {row.chips.map((chip) => (
                    <span key={chip} className={styles.chip}>
                      {chip}
                    </span>
                  ))}
                </span>
              ) : (
                'value' in row && row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Two ghost cards behind it read as one of the ten.
export function ProspectCard() {
  const p = EXAMPLES.prospect;
  return (
    <div className={styles.stack}>
      <div className={styles.card}>
        <CardHead title={p.title} />
        <dl className={styles.pairs}>
          {p.rows.map((row) => (
            <div key={row.label} className={styles.pair}>
              <dt className={styles.fieldLabel}>{row.label}</dt>
              <dd className={styles.pairValue}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.email}>
          <span className={styles.fieldLabel}>{p.emailLabel}</span>
          <span className={styles.emailPreview}>{p.email}</span>
        </div>
      </div>
    </div>
  );
}

export function DraftCard() {
  const d = EXAMPLES.draft;
  return (
    <div className={styles.card}>
      <CardHead title={d.source} />
      <p className={styles.draftSubject}>{d.subject}</p>
      <span className={`${styles.chips} ${styles.draftTags}`}>
        {d.tags.map((tag) => (
          <span key={tag} className={styles.chip}>
            {tag}
          </span>
        ))}
      </span>
      <div className={styles.email}>
        <span className={styles.fieldLabel}>{d.replyLabel}</span>
        <span className={styles.emailPreview}>{d.reply}</span>
      </div>
      <p className={styles.waiting}>
        <span className={styles.waitingDot} />
        {d.status}
      </p>
    </div>
  );
}
