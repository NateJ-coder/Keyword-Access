import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { NavTabs } from "@/components/NavTabs";

import "./globals.css";

const sansFont = Inter({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Keyword Access | Fuzio",
  description: "Fuzio's chat-first South African property-law research assistant, indexed from the CSOS Act, Sectional Titles Management Act, and management rules."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={sansFont.variable}>
        <div className="app-shell">
          <header className="site-header">
            <div className="brand-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fuzio-logo.jpg" alt="Fuzio" className="brand-logo" />
              <div>
                <p className="brand-mark">Keyword Access</p>
                <p className="brand-copy">Fuzio property-law lookup for CSOS, sectional title &amp; body corporate disputes.</p>
              </div>
            </div>
            <NavTabs />
          </header>
          <main className="site-main">{children}</main>
          <p className="footer-note">Research support only, not legal advice. Always confirm with a supervisor before acting on a dispute.</p>
        </div>
      </body>
    </html>
  );
}
