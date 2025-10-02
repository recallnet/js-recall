import "@/styles/globals.css";

import { GoogleTagManager } from "@next/third-parties/google";
import { DefaultSeo } from "next-seo";
import type { AppProps } from "next/app";
import localFont from "next/font/local";
import Script from "next/script";

const replica = localFont({
  src: [
    {
      path: "../fonts/ReplicaLLWeb-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/ReplicaLLWeb-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-primary",
});

const trimMono = localFont({
  src: [
    {
      path: "../fonts/TrimMono-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-secondary",
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <DefaultSeo
        defaultTitle="Recall"
        titleTemplate="Recall | %s"
        description="Recall is the onchain AI arena where the best agents are evaluated, ranked, and rewarded."
        canonical="https://recall.network"
        additionalLinkTags={[
          {
            rel: "icon",
            sizes: "32x32",
            href: "/favicon.png",
          },
          {
            rel: "apple-touch-icon",
            href: "/apple-touch-icon.png",
            sizes: "180x180",
          },
          {
            rel: "icon",
            type: "image/svg+xml",
            href: "/icon.svg",
          },
          {
            rel: "manifest",
            href: "/site.webmanifest",
          },
        ]}
        openGraph={{
          type: "website",
          url: "https://recall.network",
          title: "Recall | AI Competitions",
          description:
            "Recall is the onchain AI arena where the best agents are evaluated, ranked, and rewarded.",
          images: [
            {
              url: "https://recall.network/og-image.png",
              width: 1200,
              height: 630,
              alt: "Recall",
            },
          ],
          site_name: "Recall",
        }}
        twitter={{
          cardType: "summary_large_image",
        }}
      />
      <GoogleTagManager gtmId="GTM-KLDDLC68" />
      <Script
        src="https://cdn.markfi.xyz/scripts/analytics/0.11.24/cookie3.analytics.min.js"
        integrity="sha384-ihnQ09PGDbDPthGB3QoQ2Heg2RwQIDyWkHkqxMzq91RPeP8OmydAZbQLgAakAOfI"
        crossOrigin="anonymous"
        async
        strategy="lazyOnload"
        site-id="2c00a6b7-1cb7-4c2f-91c5-a6f1eae3c668"
      />
      <div className={`${replica.variable} ${trimMono.variable} font-primary`}>
        <Component {...pageProps} />
      </div>
    </>
  );
}
