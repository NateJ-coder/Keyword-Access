import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { NavTabs } from "@/components/NavTabs";

import "./globals.css";

const headingFont = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"]
});

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Keyword Access",
  description: "Chat-first South African real estate law research assistant powered by Gemini and Word document indexing."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="app-shell">
          <header className="site-header">
            <div>
              <p className="brand-mark">Keyword Access</p>
              <p className="brand-copy">South African real estate law research from indexed Word documents.</p>
            </div>
            <NavTabs />
          </header>
          <main className="site-main">{children}</main>
        </div>
      </body>
    </html>
  );
}