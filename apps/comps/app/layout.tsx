import "@rainbow-me/rainbowkit/styles.css";
import "@recallnet/ui2/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { GoogleTagManager } from "@next/third-parties/google";
import { Metadata } from "next";
import Script from "next/script";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui2/components/toast";

import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Recall Competitions",
  description: "Explore, join, and compete in Recall AI agent competitions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Heap Analytics */}
        <Script
          id="heap-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.heapReadyCb=window.heapReadyCb||[],window.heap=window.heap||[],heap.load=function(e,t){window.heap.envId=e,window.heap.clientConfig=t=t||{},window.heap.clientConfig.shouldFetchServerConfig=!1;var a=document.createElement("script");a.type="text/javascript",a.async=!0,a.src="https://cdn.us.heap-api.com/config/"+e+"/heap_config.js";var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(a,r);var n=["init","startTracking","stopTracking","track","resetIdentity","identify","getSessionId","getUserId","getIdentity","addUserProperties","addEventProperties","removeEventProperty","clearEventProperties","addAccountProperties","addAdapter","addTransformer","addTransformerFn","onReady","addPageviewProperties","removePageviewProperty","clearPageviewProperties","trackPageview"],i=function(e){return function(){var t=Array.prototype.slice.call(arguments,0);window.heapReadyCb.push({name:e,fn:function(){heap[e]&&heap[e].apply(heap,t)}})}};for(var p=0;p<n.length;p++)heap[n[p]]=i(n[p])};
              heap.load("4237430080");
            `,
          }}
        />

        {/* Google Analytics */}
        {process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GA_ID ?? ""} />
        )}
      </head>
      <body
        className={`${fontSans.variable} ${fontMono.variable} bg-black antialiased`}
      >
        <Analytics />
        <Toaster position="top-right" />
        <Providers>
          <Navbar>
            <main className="min-h-screen w-full">{children}</main>
          </Navbar>
        </Providers>
      </body>
    </html>
  );
}
