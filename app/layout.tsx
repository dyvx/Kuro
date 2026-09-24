import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/captions.css";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";
import { SITE_NAME, SITE_TAGLINE } from "@/utils/cn";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "A premium, ad-free anime streaming experience. Cinematic discovery, multi-server playback, and seamless episode tracking.",
  keywords: ["anime", "streaming", "watch anime", "anime online"],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "A premium, ad-free anime streaming experience.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: "A premium, ad-free anime streaming experience.",
  },
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#06060a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
