'use client';

// Pass-through. The old drag-to-resize used CSS `zoom`, which re-rasterizes
// text at fractional scale and renders fuzzy on non-retina displays — and a
// stale stored value could leave the whole app zoomed with no visible reset.
// "Fill the screen" is now handled by content max-width, not zoom.
export function ZoomShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
