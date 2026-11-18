import type { Metadata, Viewport } from "next";
import { company } from "@quantara/content";
import { SITE_URL } from "@/lib/site";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${company.name} | ${company.tagline}`, template: `%s | ${company.name}` },
  description: company.about[0],
  openGraph: { type: "website", siteName: company.name, title: company.name, description: company.tagline },
};
// Pages are regenerated at most every 5 minutes so edits in /admin/settings reach the footer; saving settings refreshes them immediately.
export const revalidate = 300;
export const viewport: Viewport = { themeColor: "#0a1630", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-navy-900">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
