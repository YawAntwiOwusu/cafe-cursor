import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cafe Cursor Accra | Get your free Cursor credit",
  description:
    "Register for Cafe Cursor Accra to claim your Cursor IDE credit. Hosted in Accra, Ghana.",
  keywords: ["cursor", "ide", "credit", "Accra", "Ghana", "developers", "Cafe Cursor Accra"],
  authors: [{ name: "Cafe Cursor Accra" }],
  openGraph: {
    title: "Cafe Cursor Accra | Get your free Cursor credit",
    description: "Register for Cafe Cursor Accra to claim your Cursor IDE credit.",
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
      </body>
    </html>
  );
}
