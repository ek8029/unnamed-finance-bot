import React from 'react';

/** Minimal markdown: **bold** inline, `- ` bullet groups, blank-line paragraphs.
 *  Enough for founder-voice weekly updates without pulling a markdown dependency. */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-[var(--color-text-primary)]">{p.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{p}</React.Fragment>,
  );
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? '').split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={out.length} className="my-2.5 list-disc space-y-1.5 pl-5">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    if (l.startsWith('- ')) { bullets.push(l.slice(2)); continue; }
    flush();
    out.push(<p key={out.length} className="my-3 leading-relaxed">{inline(l)}</p>);
  }
  flush();
  return <div className={className}>{out}</div>;
}
