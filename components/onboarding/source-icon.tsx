// Marks for the "how did you find Helm?" tiles. Deliberately the SAME paths as
// helm-mobile/components/source-icon.tsx, so the question looks like one
// question on both surfaces.
//
// The five brand paths are Simple Icons' official data, embedded rather than
// imported so a five-icon need does not pull a 3,000-icon package into the
// bundle. Using a platform's own mark to identify it in a "where did you hear
// about us" picker is ordinary nominative use.
//
// There is no LinkedIn tile: Simple Icons removed the mark at LinkedIn's
// request, so there is no licensed path to embed and a hand-drawn imitation of
// a logo somebody asked not to be redistributed is worse than no tile. LinkedIn
// arrives through "Something else", which takes free text.

interface Mark { path: string; brand?: string; evenOdd?: boolean }

const MARKS: Record<string, Mark> = {
  google: {
    brand: '#4285F4',
    path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z',
  },
  reddit: {
    brand: '#FF4500',
    path: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
  },
  x: {
    brand: '#FFFFFF', // official hex is black, invisible on this background
    path: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  },
  tiktok: {
    brand: '#FF0050',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  hacker_news: {
    brand: '#F0652F',
    path: 'M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z',
  },

  /* ── drawn here ── */
  ai_assistant: {
    path: 'M12 1.6l2.15 6.25L20.4 10l-6.25 2.15L12 18.4l-2.15-6.25L3.6 10l6.25-2.15L12 1.6Zm7.2 12.4l.95 2.65 2.65.95-2.65.95-.95 2.65-.95-2.65-2.65-.95 2.65-.95.95-2.65Z',
  },
  friend: {
    path: 'M12 3.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Zm0 8.4c4.1 0 7.4 2.3 7.4 5.2v2.2H4.6v-2.2c0-2.9 3.3-5.2 7.4-5.2Z',
  },
  blog_newsletter: {
    evenOdd: true,
    path: 'M5 2h9.2L19.5 7.3V22H5V2Zm9 1.9V7.6h3.7L14 3.9ZM7.6 11h8.8v1.7H7.6V11Zm0 3.6h8.8v1.7H7.6v-1.7Zm0 3.6h5.6v1.7H7.6v-1.7Z',
  },
  other: {
    path: 'M5.4 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6.6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6.6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z',
  },
};

export function SourceIcon({ slug, selected }: { slug: string; selected?: boolean }) {
  const m = MARKS[slug];
  if (!m) return null;
  // Grey until picked, so nine brand colours do not turn the screen into a
  // sticker sheet.
  const fill = selected ? m.brand ?? 'var(--color-gold)' : '#6E6E6E';
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden focusable="false" className="shrink-0">
      <path d={m.path} fill={fill} fillRule={m.evenOdd ? 'evenodd' : 'nonzero'} />
    </svg>
  );
}
