import { NextResponse } from 'next/server';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { resend } from '@/lib/emails/resend';
import { SAMPLE_FORM } from '@/components/outbound/copy';

// Free sample intake from /outbound. Emails the request to Evan with reply-to
// set to the sender, so answering is a normal reply. Nothing is stored and
// nothing is sent to the address the visitor typed, so the form cannot be
// used to email third parties.

const FROM = 'Helm Outbound <hello@helmterminal.dev>';

// Fields, whether required, and a length cap so the email stays readable and
// the route cannot be used to post large payloads.
const FIELDS = {
  name: { required: true, max: 120 },
  business: { required: true, max: 160 },
  email: { required: true, max: 200 },
  phone: { required: false, max: 40 },
  sells: { required: true, max: 400 },
  targets: { required: true, max: 400 },
  area: { required: true, max: 240 },
  exclude: { required: false, max: 800 },
} as const;

type Field = keyof typeof FIELDS;

// A person needs more than this to fill the form; scripts usually do not wait.
const MIN_FILL_MS = 2500;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, multiline: boolean): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return multiline ? trimmed.replace(/\r\n?/g, '\n') : trimmed.replace(/[\r\n]+/g, ' ');
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const { allowed, retryAfterSeconds } = rateLimit(`outbound-sample:${ip}`, 5, 3600);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
        { status: 429 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'The request could not be read.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'The request could not be read.' }, { status: 400 });
    }

    // Bots: a filled hidden field, or a form submitted faster than a person
    // can type. Answer as if it worked so they learn nothing, and send nothing.
    const honeypot = clean(body.website, false);
    const elapsed = typeof body.elapsedMs === 'number' ? body.elapsedMs : 0;
    if (honeypot || elapsed < MIN_FILL_MS) {
      return NextResponse.json({ success: true });
    }

    const values = {} as Record<Field, string>;
    for (const key of Object.keys(FIELDS) as Field[]) {
      const rule = FIELDS[key];
      const value = clean(body[key], key === 'exclude');
      if (rule.required && !value) {
        return NextResponse.json({ error: `${SAMPLE_FORM.fields[key].label} is required.`, field: key }, { status: 400 });
      }
      if (value.length > rule.max) {
        return NextResponse.json({ error: `${SAMPLE_FORM.fields[key].label} is too long.`, field: key }, { status: 400 });
      }
      values[key] = value;
    }

    values.email = values.email.toLowerCase();
    if (!EMAIL_RE.test(values.email)) {
      return NextResponse.json({ error: 'That email address does not look right.', field: 'email' }, { status: 400 });
    }

    if (!resend) {
      console.error('Outbound sample form: Resend not configured (missing RESEND_API_KEY)');
      return NextResponse.json({ error: SAMPLE_FORM.error }, { status: 503 });
    }

    const lines = (Object.keys(FIELDS) as Field[])
      .filter((key) => values[key])
      .map((key) => `${SAMPLE_FORM.fields[key].label.replace(' (optional)', '')}: ${values[key]}`);

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: SAMPLE_FORM.to,
      replyTo: values.email,
      subject: `Free sample request: ${values.business}`,
      text: ['New free sample request from helmterminal.dev/outbound.', '', ...lines].join('\n'),
    });

    if (sendError) {
      console.error('Outbound sample form send error:', sendError);
      return NextResponse.json({ error: SAMPLE_FORM.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Outbound sample form error:', error);
    return NextResponse.json({ error: SAMPLE_FORM.error }, { status: 500 });
  }
}
