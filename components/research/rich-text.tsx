// Shared micro-renderer for the research prose surfaces: the only markup the
// composer is allowed to emit is **bold**, and this turns it into <strong>.
// Everything else in the prose pipeline is plain text.

import { Fragment, type ReactNode } from 'react';

export function withBold(text: string, keyPrefix: string | number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (!m) return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
    return (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">
        {m[1]}
      </strong>
    );
  });
}
