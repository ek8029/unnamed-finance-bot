import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import "./globals.css";
import { Providers } from '@/components/providers';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['300', '400', '500', '600', '700'],
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
      <body className={`${interTight.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
