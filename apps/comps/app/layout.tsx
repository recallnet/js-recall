import "./globals.css";

import { Metadata } from "next";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui2/components/toast";

import { CookieConsentProvider } from "@/components/cookie-consent-provider";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { Tracking } from "@/components/tracking";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata();
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="cc--darkmode" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} bg-black antialiased`}
      >
        <CookieConsentProvider>
          <Tracking />
          <Toaster position="top-right" />
          <Providers>
            <Navbar />
            <main className="mx-auto min-h-screen w-full max-w-screen-lg px-5 pt-10 sm:px-20">
              {children}
            </main>
          </Providers>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
