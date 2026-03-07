import type { Metadata } from "next";
import { Manrope, DM_Mono } from 'next/font/google';
import "./globals.css";
import { Providers } from '@/components/providers';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  weight: ['300', '400', '500', '600', '700'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: "Helm — Financial Intelligence",
  description: "AI-powered personal financial intelligence platform. Institutional-grade financial intelligence built for individuals.",
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
