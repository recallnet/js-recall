"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

import { useCookieConsentState } from "@/components/cookie-consent-provider";

export function Tracking() {
  const { consent } = useCookieConsentState();
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID;
  const HOTJAR_SV = process.env.NEXT_PUBLIC_HOTJAR_SV;

  // Only load tracking scripts if user has consented
  if (!consent) {
    return null;
  }

  return (
    <>
      <Analytics />
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      {HOTJAR_ID && HOTJAR_SV && (
        <Script
          id="hotjar"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${HOTJAR_ID},hjsv:${HOTJAR_SV}};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `,
          }}
        />
      )}
      <Script
        src="https://cdn.markfi.xyz/scripts/analytics/0.11.24/cookie3.analytics.min.js"
        integrity="sha384-ihnQ09PGDbDPthGB3QoQ2Heg2RwQIDyWkHkqxMzq91RPeP8OmydAZbQLgAakAOfI"
        crossOrigin="anonymous"
        async
        strategy="lazyOnload"
        data-site-id="9aa1fb36-6095-4021-8d09-049e75d5f1a5"
      />
    </>
  );
}
