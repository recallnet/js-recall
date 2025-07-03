import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";

export function Tracking() {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const HOTJAR_ID = process.env.NEXT_PUBLIC_HOTJAR_ID;
  const HOTJAR_SV = process.env.NEXT_PUBLIC_HOTJAR_SV;
  return (
    <>
      <Analytics />
      {process.env.NODE_ENV !== "development" && GA_ID && (
        <GoogleAnalytics gaId={GA_ID} />
      )}
      {process.env.NODE_ENV !== "development" && HOTJAR_ID && HOTJAR_SV && (
        <Script id={"hotjar"} strategy={"beforeInteractive"}>
          {`
          (function(h,o,t,j,a,r){
            h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
            h._hjSettings={hjid:${HOTJAR_ID},hjsv:${HOTJAR_SV};
            a=o.getElementsByTagName('head')[0];
            r=o.createElement('script');r.async=1;
            r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
            a.appendChild(r);
          })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
        `}
        </Script>
      )}
    </>
  );
}
