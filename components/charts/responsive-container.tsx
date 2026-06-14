'use client';

// Mount-gated drop-in for Recharts' ResponsiveContainer. Recharts measures the
// container on first paint, before the browser has laid it out, and logs
// "width(-1) and height(-1) of chart..." then redraws. Rendering only after mount
// (when the parent has real dimensions) avoids the warning entirely - in dev and
// prod, no console patching. Import this instead of recharts' ResponsiveContainer.

import { useEffect, useState, type ComponentProps } from 'react';
import { ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

export function ResponsiveContainer(props: ComponentProps<typeof RechartsResponsiveContainer>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ width: '100%', height: '100%' }} />;
  return <RechartsResponsiveContainer {...props} />;
}
