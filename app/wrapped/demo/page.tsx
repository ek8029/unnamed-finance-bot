import type { Metadata } from 'next';
import { WrappedDemo } from './wrapped-demo';

export const metadata: Metadata = {
  title: 'Demo: Spotify Wrapped for Your Portfolio | Helm',
  description:
    'See what Helm Wrapped looks like. 7 slides with your real portfolio data: return vs S&P, best and worst trades, investor personality type. Free.',
  openGraph: {
    title: 'See What Helm Wrapped Looks Like: Demo',
    description:
      'Spotify Wrapped for your investments. Preview all 7 slides.',
    url: 'https://helmterminal.dev/wrapped/demo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helm Wrapped Demo: Spotify Wrapped for Your Portfolio',
  },
  // Noindex: the demo is a client-rendered slide deck with 21 words of server
  // HTML, which crawlers score as thin. It stays shareable and reachable from
  // /wrapped; it is out of the sitemap for the same reason.
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://helmterminal.dev/wrapped/demo' },
};

export default function WrappedDemoPage() {
  return <WrappedDemo />;
}
