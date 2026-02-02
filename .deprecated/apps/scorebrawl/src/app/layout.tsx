import "./globals.css";

import { Analytics, Providers } from "@/components/providers";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { siteConfig } from "@/config/site";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";

import { Toaster } from "@/components/ui/toaster";
import { TRPCReactProvider } from "@/trpc/react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
interface RootLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: ["Scorebrawl"],
  authors: [
    {
      name: "palmithor",
    },
  ],
  creator: "palmithor",
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.openGraphImage],
    creator: "@palmithor",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-icon-180x180.png",
  },
  manifest: `${siteConfig.url}/manifest.json`,
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-screen-safe bg-background font-sans antialiased`}
      >
        <TRPCReactProvider>
          <Providers attribute="class" defaultTheme="system" enableSystem>
            {children}
            <Analytics />
            <SpeedInsights />
            <Toaster />
            <TailwindIndicator />
          </Providers>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
