'use client';

// Drag-to-resize the whole terminal. A grip (bottom-right) scales the dashboard content
// 100-200% via CSS zoom, so everything grows together on large displays instead of
// leaving black margins. Persisted to localStorage; double-click the grip to reset.
// The grip sits outside the zoomed tree, so it stays a constant size.
import { useState, useEffect, useRef } from 'react';

export function ZoomShell({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const start = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => {
    const z = parseFloat(localStorage.getItem('helm_keel_zoom') || '1');
    if (z >= 1 && z <= 2) setZoom(z);
  }, []);
  useEffect(() => {
    try { localStorage.setItem('helm_keel_zoom', String(zoom)); } catch {}
  }, [zoom]);

  return (
    <>
      <div style={{ zoom }}>{children}</div>
      <div
        onPointerDown={(e) => { start.current = { x: e.clientX, z: zoom }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (start.current) setZoom(Math.min(2, Math.max(1, start.current.z + (e.clientX - start.current.x) * 0.0016))); }}
        onPointerUp={(e) => { start.current = null; try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {} }}
        onDoubleClick={() => setZoom(1)}
        title="Drag to resize the terminal · double-click to reset"
        style={{
          position: 'fixed', right: 'calc(var(--rail-w, 0px) + 18px)', bottom: 18, zIndex: 50, cursor: 'ew-resize',
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 8,
          background: '#141414', border: '1px solid rgba(255,255,255,0.10)', userSelect: 'none', touchAction: 'none',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8A8A8A' }}>⟷ {Math.round(zoom * 100)}%</span>
      </div>
    </>
  );
}
