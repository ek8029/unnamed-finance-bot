'use client';

import { useEffect, useState } from 'react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav className="sticky top-24">
      <p className="type-eyebrow text-[var(--color-text-muted)] mb-3">
        On this page
      </p>
      <ul className="space-y-1.5 border-l border-[var(--color-border-base)]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-[14px] leading-snug transition-colors border-l -ml-px py-1 ${
                h.level === 3 ? 'pl-6' : 'pl-4'
              } ${
                activeId === h.id
                  ? 'border-[var(--color-gold)] text-[var(--color-gold)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
