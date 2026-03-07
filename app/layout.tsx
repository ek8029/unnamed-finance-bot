import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Personal CFO",
  description: "AI-powered personal financial intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
