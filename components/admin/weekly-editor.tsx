'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WeeklyUpdate } from '@/lib/content/weekly-updates';
import { saveUpdate, setPublished, deleteUpdate, emailUpdate, emailUpdateTest } from '@/app/admin/updates/actions';

function mondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

const BLANK = (marketDraft: string) => ({
  week_of: mondayISO(),
  title: '',
  intro: '',
  body_helm: '',
  body_market: marketDraft,
});

export function WeeklyEditor({ updates, marketDraft }: { updates: WeeklyUpdate[]; marketDraft: string }) {
  const router = useRouter();
  const [form, setForm] = useState(BLANK(marketDraft));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const existing = updates.find((u) => u.week_of === form.week_of) ?? null;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadNew = () => { setForm(BLANK(marketDraft)); setMsg(''); };
  const load = (u: WeeklyUpdate) => {
    setForm({ week_of: u.week_of, title: u.title, intro: u.intro, body_helm: u.body_helm, body_market: u.body_market ?? '' });
    setMsg('');
  };

  async function onSave() {
    setBusy(true); setMsg('');
    const res = await saveUpdate(form);
    setBusy(false);
    setMsg(res.ok ? 'Saved.' : `Error: ${res.error}`);
    if (res.ok) router.refresh();
  }

  async function onPublish(publish: boolean) {
    setBusy(true); setMsg('');
    // make sure the latest edits are persisted first
    const saved = await saveUpdate(form);
    if (!saved.ok) { setBusy(false); setMsg(`Error: ${saved.error}`); return; }
    const res = await setPublished(form.week_of, publish);
    setBusy(false);
    setMsg(res.ok ? (publish ? 'Published + live.' : 'Unpublished.') : `Error: ${res.error}`);
    if (res.ok) router.refresh();
  }

  async function onDelete() {
    if (!existing) return;
    if (!window.confirm(`Delete the ${existing.week_of} issue? This cannot be undone.`)) return;
    setBusy(true); setMsg('');
    const res = await deleteUpdate(existing.week_of);
    setBusy(false);
    if (res.ok) { setMsg('Deleted.'); loadNew(); router.refresh(); }
    else setMsg(`Error: ${res.error}`);
  }

  function onCopyResend() {
    const strip = (s: string) => s.replace(/\*\*/g, '');
    const body = [
      `Subject: This Week at Helm — ${form.title}`,
      '',
      'Hey {{{FIRST_NAME}}},',
      '',
      form.intro,
      '',
      'WHAT CHANGED AT HELM',
      strip(form.body_helm),
      form.body_market.trim() ? '\nBROADER MARKET UPDATE\n' + strip(form.body_market) : '',
      '',
      `Read it on the site: https://helmterminal.dev/this-week/${form.week_of}`,
      '',
      'Evan',
    ].join('\n');
    navigator.clipboard.writeText(body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  const field = 'w-full rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-base)] px-3 py-2.5 text-[14px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-gold)]/50';
  const label = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]';

  return (
    <div className="space-y-6">
      {/* Issue picker */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={loadNew} className="rounded-full bg-[var(--color-gold)] px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-bg-base)]">+ New issue</button>
        {updates.map((u) => (
          <button
            key={u.id}
            onClick={() => load(u)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${form.week_of === u.week_of ? 'border-[var(--color-gold)] text-[var(--color-gold)]' : 'border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            {u.week_of}{u.status === 'draft' ? ' · draft' : ''}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-5 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className={label}>Week of</label>
            <input type="date" value={form.week_of} onChange={set('week_of')} className={field} />
          </div>
          <div>
            <label className={label}>Title</label>
            <input value={form.title} onChange={set('title')} placeholder="What changed this week" className={field} />
          </div>
        </div>

        <div>
          <label className={label}>Intro (one or two lines)</label>
          <textarea value={form.intro} onChange={set('intro')} rows={2} className={field} />
        </div>

        <div>
          <label className={label}>What changed at Helm (markdown: **bold**, - bullets)</label>
          <textarea value={form.body_helm} onChange={set('body_helm')} rows={7} className={`${field} font-mono`} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className={`${label} mb-0`}>Broader market update (pre-drafted from real data)</label>
            <button onClick={() => setForm((f) => ({ ...f, body_market: marketDraft }))} className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)]">Reset to draft</button>
          </div>
          <textarea value={form.body_market} onChange={set('body_market')} rows={8} className={`${field} font-mono`} />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border-base)] pt-4">
          <button disabled={busy} onClick={onSave} className="rounded-[6px] border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] disabled:opacity-50">Save draft</button>
          {existing?.status === 'published' ? (
            <button disabled={busy} onClick={() => onPublish(false)} className="rounded-[6px] border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] disabled:opacity-50">Unpublish</button>
          ) : (
            <button disabled={busy} onClick={() => onPublish(true)} className="rounded-[6px] bg-[var(--color-gold)] px-4 py-2 text-[13px] font-bold text-[var(--color-bg-base)] disabled:opacity-50">Publish</button>
          )}
          {existing && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg('');
                const res = await emailUpdateTest(form.week_of);
                setBusy(false);
                setMsg(res.ok ? 'Test email sent to you.' : `Error: ${res.error}`);
              }}
              className="rounded-[6px] border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] disabled:opacity-50"
            >
              Send test to me
            </button>
          )}
          {existing?.status === 'published' && (
            <button
              disabled={busy}
              onClick={async () => {
                if (!confirm('Email this update to all subscribed users? It sends once and cannot be repeated.')) return;
                setBusy(true);
                setMsg('');
                const res = await emailUpdate(form.week_of);
                setBusy(false);
                setMsg(res.ok ? `Emailed to ${res.sent} subscribers.` : `Error: ${res.error}`);
              }}
              className="rounded-[6px] border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-4 py-2 text-[13px] font-bold text-[var(--color-gold)] disabled:opacity-50"
            >
              Email subscribers
            </button>
          )}
          <button onClick={onCopyResend} className="rounded-[6px] border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)]">{copied ? 'Copied' : 'Copy for Resend'}</button>
          {existing && (
            <button disabled={busy} onClick={onDelete} className="rounded-[6px] border border-[var(--color-negative)]/40 px-4 py-2 text-[13px] font-semibold text-[var(--color-negative)] disabled:opacity-50">Delete</button>
          )}
          {existing?.status === 'published' && (
            <a href={`/this-week/${form.week_of}`} target="_blank" rel="noreferrer" className="font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--color-gold)]">View live &rarr;</a>
          )}
          {msg && <span className="text-[13px] text-[var(--color-text-muted)]">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
