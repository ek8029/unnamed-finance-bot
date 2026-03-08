// Helm Meridian Mark — Single source of truth
// Based on Helm Design System v3.0 — Dark Grayscale + Gold

interface HelmMarkProps {
  size?: number;      // rendered px size
  variant?: 'default' | 'light' | 'mono';  // color scheme
  className?: string;
}

export const HelmMark = ({ size = 24, variant = 'default', className }: HelmMarkProps) => {
  const colors = {
    default: {
      arc:       '#C8A95B',   // gold
      crosshair: '#EAEAEA',   // platinum
      node:      '#C8A95B',   // gold
      hubOuter:  '#EAEAEA',   // platinum
      hubInner:  '#C8A95B',   // gold
    },
    light: {
      arc:       '#8A6A35',
      crosshair: '#1A1A1A',
      node:      '#8A6A35',
      hubOuter:  '#1A1A1A',
      hubInner:  '#8A6A35',
    },
    mono: {
      arc:       'currentColor',
      crosshair: 'currentColor',
      node:      'currentColor',
      hubOuter:  'currentColor',
      hubInner:  'transparent',
    },
  };

  const c = colors[variant];

  // At ≤16px, render simplified favicon version
  if (size <= 16) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
        <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
              stroke={c.arc} strokeWidth="4.5" strokeLinecap="round"/>
        <line x1="28" y1="7" x2="28" y2="49"
              stroke={c.crosshair} strokeWidth="5" strokeLinecap="round"/>
        <line x1="7" y1="28" x2="49" y2="28"
              stroke={c.crosshair} strokeWidth="5" strokeLinecap="round"/>
        <circle cx="28" cy="28" r="10" fill={c.node}/>
      </svg>
    );
  }

  // 17px–32px: small mark (thicker strokes, larger nodes)
  if (size <= 32) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
        <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
              stroke={c.arc} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="28" y1="7" x2="28" y2="49"
              stroke={c.crosshair} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="7" y1="28" x2="49" y2="28"
              stroke={c.crosshair} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="28" cy="7" r="4.5" fill={c.node}/>
        <circle cx="28" cy="28" r="6" fill={c.hubOuter}/>
        <circle cx="28" cy="28" r="3" fill={c.hubInner}/>
      </svg>
    );
  }

  // 33px+: full mark with all details
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className}>
      <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94"
            stroke={c.arc} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="28" y1="7" x2="28" y2="49"
            stroke={c.crosshair} strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="7" y1="28" x2="49" y2="28"
            stroke={c.crosshair} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="28" cy="7" r="3" fill={c.node}/>
      <circle cx="49" cy="28" r="2.5" fill={c.node}/>
      <circle cx="7" cy="28" r="2.5" fill={c.node}/>
      <circle cx="28" cy="28" r="4.2" fill={c.hubOuter}/>
      <circle cx="28" cy="28" r="2" fill={c.hubInner}/>
    </svg>
  );
};
