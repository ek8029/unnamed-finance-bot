import Link from 'next/link';

const VARIANTS = [
  {
    href: '/outbound',
    title: 'Dawn, now the live page at /outbound',
    blurb: 'From a study of Mercury, Stripe, Linear and Collins: one cinematic image, small sure type, and the service shown as the things a client gets. Illustration wording is example text, not approved.',
  },
  {
    href: '/testing/outbound/proposal',
    title: 'Proposal',
    blurb: 'Warm paper, a serif set like an engagement letter from an established firm, forest green as the one accent.',
  },
  {
    href: '/testing/outbound/worksheet',
    title: 'Work order',
    blurb: 'A printed job sheet: ruled cells, form labels, condensed headlines, one hi-vis orange. Includes a sample prospect record (extra words, needs sign-off).',
  },
  {
    href: '/testing/outbound/firm',
    title: 'Quiet firm',
    blurb: 'Contemporary professional services: very large type, lots of air, a full-width navy band for the offer.',
  },
];

export default function OutboundLabIndex() {
  return (
    <main style={{ background: '#f6f5f1', color: '#16161a', fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }} className="px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[12px] uppercase tracking-[0.14em] mb-3" style={{ color: '#666' }}>Design lab · not shipped</p>
        <h1 className="text-[34px] font-semibold tracking-tight mb-10">Helm Outbound</h1>
        <ul style={{ borderTop: '1px solid #d8d5cc' }}>
          {VARIANTS.map((v) => (
            <li key={v.href} style={{ borderBottom: '1px solid #d8d5cc' }}>
              <Link href={v.href} className="block py-6 group">
                <span className="block text-[18px] font-semibold group-hover:underline">{v.title}</span>
                <span className="block mt-1 text-[15px] leading-relaxed" style={{ color: '#555' }}>{v.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
