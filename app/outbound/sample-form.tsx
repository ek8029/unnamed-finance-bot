'use client';

// The free sample intake form. Posts to /api/outbound/sample, which emails
// the request to Evan. Wording lives in SAMPLE_FORM in
// components/outbound/copy.ts.

import { useRef, useState, type FormEvent } from 'react';
import { SAMPLE_FORM } from '@/components/outbound/copy';
import styles from './page.module.css';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type FieldKey = keyof typeof SAMPLE_FORM.fields;

const F = SAMPLE_FORM.fields;

function Field({
  name,
  type = 'text',
  required = false,
  autoComplete,
  multiline = false,
  wide = false,
  invalid,
}: {
  name: FieldKey;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  multiline?: boolean;
  wide?: boolean;
  invalid: boolean;
}) {
  const id = `sample-${name}`;
  const common = {
    id,
    name,
    required,
    placeholder: F[name].placeholder || undefined,
    'aria-invalid': invalid || undefined,
    className: styles.input,
  };
  return (
    <div className={`${styles.formField} ${wide ? styles.formWide : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {F[name].label}
      </label>
      {multiline ? (
        <textarea {...common} rows={3} className={`${styles.input} ${styles.textarea}`} />
      ) : (
        <input {...common} type={type} autoComplete={autoComplete} />
      )}
    </div>
  );
}

export function SampleForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [badField, setBadField] = useState<string | null>(null);
  // When the form first rendered, so the server can tell a person from a script.
  const startedAt = useRef<number>(Date.now());

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setMessage('');
    setBadField(null);

    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await fetch('/api/outbound/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elapsedMs: Date.now() - startedAt.current }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(typeof json.error === 'string' ? json.error : SAMPLE_FORM.error);
        setBadField(typeof json.field === 'string' ? json.field : null);
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('error');
      setMessage(SAMPLE_FORM.error);
    }
  }

  if (status === 'sent') {
    return (
      <div className={`${styles.formCard} ${styles.formSent}`} role="status">
        <span className={styles.sentTick} aria-hidden="true" />
        <p className={styles.sentTitle}>{SAMPLE_FORM.sent.title}</p>
        <p className={styles.sentBody}>{SAMPLE_FORM.sent.body}</p>
      </div>
    );
  }

  return (
    <form className={styles.formCard} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <Field name="name" required autoComplete="name" invalid={badField === 'name'} />
        <Field name="business" required autoComplete="organization" invalid={badField === 'business'} />
        <Field name="email" type="email" required autoComplete="email" invalid={badField === 'email'} />
        <Field name="phone" type="tel" autoComplete="tel" invalid={badField === 'phone'} />
        <Field name="sells" required wide invalid={badField === 'sells'} />
        <Field name="targets" required wide invalid={badField === 'targets'} />
        <Field name="area" required wide invalid={badField === 'area'} />
        <Field name="exclude" multiline wide invalid={badField === 'exclude'} />
      </div>

      {/* Hidden from people; bots that fill every field give themselves away. */}
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor="sample-website">Website</label>
        <input id="sample-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={styles.formFoot}>
        <button type="submit" className={`${styles.btn} ${styles.btnInk} ${styles.formSubmit}`} disabled={status === 'sending'}>
          {status === 'sending' ? SAMPLE_FORM.sending : SAMPLE_FORM.submit}
        </button>
        <p className={styles.formNote}>{SAMPLE_FORM.note}</p>
      </div>
      <p className={styles.formError} role="alert" aria-live="assertive">
        {status === 'error' ? message : ''}
      </p>
    </form>
  );
}
