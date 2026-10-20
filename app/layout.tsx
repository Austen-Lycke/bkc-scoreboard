import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font, so the operator laptop and the TV also have them offline.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "500",
});

export const metadata: Metadata = {
  title: { default: "BKC Wedstrijden", template: "%s · BKC Wedstrijden" },
  description: "Live scores, uitslagen en klassementen van de Brugse Katapultclub.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${bricolage.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
