import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Ghana Meetup - Builders Day Edition with Cursor Team | Get your free Cursor credit",
  description:
    "Register for Cursor Ghana Meetup - Builders Day Edition with Cursor Team to claim your Cursor IDE credit. Hosted in Ghana.",
  keywords: [
    "cursor",
    "ide",
    "credit",
    "Ghana",
    "developers",
    "Cursor Ghana Meetup",
    "Builders Day",
    "meetup",
  ],
  authors: [{ name: "Cursor Ghana Meetup - Builders Day Edition with Cursor Team" }],
  openGraph: {
    title: "Cursor Ghana Meetup - Builders Day Edition with Cursor Team | Get your free Cursor credit",
    description:
      "Register for Cursor Ghana Meetup - Builders Day Edition with Cursor Team to claim your Cursor IDE credit.",
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
      <body className={`${GeistSans.className} antialiased`}>
        <LanguageProvider>{children}</LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
