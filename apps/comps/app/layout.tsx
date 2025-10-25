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
            <div className="flex h-screen flex-col">
              <Navbar />
              <main className="mx-auto w-full max-w-screen-2xl flex-1 px-5 pt-4 sm:px-12">
                {children}
              </main>
            </div>
          </Providers>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
