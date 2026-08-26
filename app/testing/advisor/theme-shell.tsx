'use client';

// The advisor lab's root: holds the theme, draws the strip. Six palettes, three
// light and three dark, chosen from ?theme= or the last pick in localStorage.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { THEMES, type ThemeId } from './themes';

const SCREENS = [
  { href: '/testing/advisor/book', label: 'The book' },
  { href: '/testing/advisor/client', label: 'Household' },
  { href: '/testing/advisor/note', label: 'The note' },
  { href: '/testing/advisor/digest', label: 'Digest' },
  { href: '/testing/advisor/consent', label: 'Consent' },
  { href: '/testing/advisor/compliance', label: 'Compliance' },
];

export function ThemeShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>('paper');

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('theme');
      const stored = window.localStorage.getItem('adv-theme');
      const pick = (q || stored) as ThemeId | null;
      if (pick && THEMES.some((t) => t.id === pick)) setTheme(pick);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('adv-theme', theme); } catch {}
  }, [theme]);

  return (
    <div className="adv-root" data-theme={theme}>
      <header className="adv-strip">
        <Link href="/testing/advisor" className="adv-strip-name">
          Helm <span>for advisors</span>
        </Link>
        <nav className="adv-strip-nav">
          {SCREENS.map((s) => (
            <Link key={s.href} href={s.href}>{s.label}</Link>
          ))}
        </nav>
        <div className="adv-themes" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`adv-theme-btn ${t.id === theme ? 'on' : ''}`}
              title={t.line}
              aria-pressed={t.id === theme}
            >
              <i data-swatch={t.id} />
              {t.name}
            </button>
          ))}
        </div>
      </header>
      {children}
    </div>
  );
}
