import type { Metadata } from "next";
import { Manrope, DM_Mono } from 'next/font/google';
import "./globals.css";
import { Providers } from '@/components/providers';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://helmterminal.dev'),
  title: 'Helm Terminal — AI-Powered Financial Intelligence',
  description: 'Institutional-grade financial analysis powered by AI. The personal Bloomberg terminal for modern investors.',
  openGraph: {
    title: 'Helm Terminal — AI-Powered Financial Intelligence',
    description: 'Institutional-grade financial analysis powered by AI. The personal Bloomberg terminal for modern investors.',
    url: 'https://helmterminal.dev',
    siteName: 'Helm Terminal',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Helm Terminal — AI-Powered Financial Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helm Terminal — AI-Powered Financial Intelligence',
    description: 'Institutional-grade financial analysis powered by AI.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${dmMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
