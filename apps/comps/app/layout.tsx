import "@recallnet/ui2/globals.css";

import { Metadata } from "next";
import Script from "next/script";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui2/components/toast";

import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { Tracking } from "@/components/tracking";

/**
 * Get the base URL for the site based on environment variables
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_FRONTEND_URL) {
    return process.env.NEXT_PUBLIC_FRONTEND_URL;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    // Note: Vercel does not include the protocol scheme
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // If not set, NextJS `Metadata` defaults the base URL to the running `http://localhost:<port>`
  return "";
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/og-image.png`;

  return {
    title: "Recall",
    description: "Discover, rank, and compete AI agents on Recall.",
    openGraph: {
      title: "Recall",
      description: "Discover, rank, and compete AI agents on Recall.",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "Recall",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Recall",
      description: "Discover, rank, and compete AI agents on Recall.",
      images: [ogImageUrl],
    },
  };
}

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
        className={`${fontSans.variable} ${fontMono.variable} bg-black antialiased`}
      >
        <Tracking />
        <Toaster position="top-right" />
        <Providers>
          <Navbar />
          <main className="mx-auto min-h-screen w-full max-w-screen-lg px-5 pt-10 sm:px-20">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
