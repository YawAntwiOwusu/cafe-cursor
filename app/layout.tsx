import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/components/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor Hackathon UCC | Get your free Cursor credit",
  description:
    "Register for Cursor Hackathon UCC to claim your Cursor IDE credit. Hosted at UCC, Ghana.",
  keywords: ["cursor", "ide", "credit", "UCC", "Ghana", "developers", "Cursor Hackathon UCC", "hackathon"],
  authors: [{ name: "Cursor Hackathon UCC" }],
  openGraph: {
    title: "Cursor Hackathon UCC | Get your free Cursor credit",
    description: "Register for Cursor Hackathon UCC to claim your Cursor IDE credit.",
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
