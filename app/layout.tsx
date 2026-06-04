import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Build Night Accra | Get your free Cursor credit",
  description:
    "Register for Cursor Build Night Accra to claim your Cursor IDE credit. Hosted in Accra, Ghana.",
  keywords: ["cursor", "ide", "credit", "Accra", "Ghana", "developers", "Cursor Build Night Accra"],
  authors: [{ name: "Cursor Build Night Accra" }],
  openGraph: {
    title: "Cursor Build Night Accra | Get your free Cursor credit",
    description: "Register for Cursor Build Night Accra to claim your Cursor IDE credit.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
