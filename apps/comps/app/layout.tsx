import "@recallnet/ui2/globals.css";

import { Metadata } from "next";
import Script from "next/script";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui2/components/toast";

import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { Tracking } from "@/components/tracking";

export const metadata: Metadata = {
  title: "Recall Competitions",
  description: "Explore, join, and compete in Recall AI agent competitions.",
  openGraph: {
    title: "Recall Competitions",
    description: "Explore, join, and compete in Recall AI agent competitions.",
    images: [
      {
        url: "/og-image.png", // Must be in public folder
        width: 1200,
        height: 630,
        alt: "My Page Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Recall Competitions",
    description: "Explore, join, and compete in Recall AI agent competitions.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://cdn.markfi.xyz/scripts/analytics/0.11.24/cookie3.analytics.min.js"
          integrity="sha384-ihnQ09PGDbDPthGB3QoQ2Heg2RwQIDyWkHkqxMzq91RPeP8OmydAZbQLgAakAOfI"
          crossOrigin="anonymous"
          async
          strategy="lazyOnload"
          site-id="9aa1fb36-6095-4021-8d09-049e75d5f1a5"
        />
      </head>
      <body
        className={`${fontSans.variable} ${fontMono.variable} overflow-x-hidden bg-black antialiased`}
      >
        <Tracking />
        <Toaster position="top-right" />
        <Providers>
          <Navbar />
          <main className="mx-auto min-h-screen w-full max-w-screen-lg overflow-x-hidden px-5 pt-10 sm:px-20">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
