// Pure HTML rendering for the This Week at Helm email. No server deps, so
// tests and scripts can import it directly; lib/emails/weekly-update.ts owns
// the send.
import { unsubUrl } from '@/lib/emails/unsubscribe';

// Mirrors MarkdownLite (bold, "- " bullets, blank-line paragraphs) plus
// [text](url) links, as inline-styled email HTML.
export function mdToEmailHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#FAFAFA;">$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#E6B94D;text-decoration:none;">$1</a>')
      .replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '<a href="https://helmterminal.dev$2" style="color:#E6B94D;text-decoration:none;">$1</a>');

  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';
      if (lines.every((l) => l.trim().startsWith('- '))) {
        const items = lines
          .map((l) => `<li style="margin:0 0 6px;">${inline(l.trim().slice(2))}</li>`)
          .join('');
        return `<ul style="margin:0 0 18px;padding-left:22px;color:#B8B8B8;font-size:15px;line-height:1.6;">${items}</ul>`;
      }
      return `<p style="margin:0 0 18px;color:#B8B8B8;font-size:15px;line-height:1.65;">${inline(lines.join(' '))}</p>`;
    })
    .join('');
}

export interface WeeklyEmailInput {
  week_of: string;
  title: string;
  intro: string;
  body_helm: string;
  body_market: string | null;
}

export function buildWeeklyEmailHtml(u: WeeklyEmailInput, userId: string): string {
  const url = `https://helmterminal.dev/this-week/${u.week_of}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0A0A0A;">
<div style="max-width:600px;margin:0 auto;padding:36px 24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E6B94D;font-weight:700;margin-bottom:10px;">&#10022; This Week at Helm</div>
  <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#FAFAFA;">${u.title}</h1>
  ${u.intro ? `<p style="margin:0 0 22px;color:#D4D4D4;font-size:16px;line-height:1.6;">${u.intro}</p>` : ''}
  ${mdToEmailHtml(u.body_helm)}
  ${u.body_market ? `<div style="border-top:1px solid #222;margin:24px 0;padding-top:22px;"><div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8A8A8A;font-weight:700;margin-bottom:12px;">The broader market</div>${mdToEmailHtml(u.body_market)}</div>` : ''}
  <a href="${url}" style="display:inline-block;margin-top:6px;padding:10px 18px;background:#E6B94D;color:#0A0A0A;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;">Read on the site &rarr;</a>
  <p style="margin:34px 0 0;padding-top:18px;border-top:1px solid #1C1C1C;font-size:12px;line-height:1.6;color:#6A6A6A;">
    You're getting this because you have a Helm Terminal account.
    <a href="${unsubUrl(userId, 'weekly')}" style="color:#8A8A8A;">Unsubscribe from the weekly update</a>
  </p>
</div></body></html>`;
}
