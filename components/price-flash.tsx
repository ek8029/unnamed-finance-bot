'use client';

/**
 * Wraps a price display and flashes its background green/red whenever
 * the underlying numeric value ticks up/down. The key remount restarts
 * the CSS animation even when consecutive ticks move the same way.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function PriceFlash({
  value,
  className,
  children,
}: {
  value: number | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<{ dir: 'up' | 'down' | null; n: number }>({
    dir: null,
    n: 0,
  });

  useEffect(() => {
    if (typeof value !== 'number' || !isFinite(value)) return;
    const last = prev.current;
    prev.current = value;
    if (last === null || last === value) return;
    setFlash((f) => ({ dir: value > last ? 'up' : 'down', n: f.n + 1 }));
  }, [value]);

  return (
    <span
      key={flash.n}
      className={`${className ?? ''} ${flash.dir ? `price-flash-${flash.dir}` : ''}`.trim()}
    >
      {children}
    </span>
  );
}
