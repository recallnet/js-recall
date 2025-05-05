import "@recallnet/ui2/globals.css";
import '@rainbow-me/rainbowkit/styles.css';

import {Analytics} from "@vercel/analytics/react";
import {Metadata} from "next";

import {fontMono, fontSans} from "@recallnet/fonts";

import {Navbar} from "@/components/Navbar";
import {Providers} from "@/components/providers";

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
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Analytics />
        <Providers >
          <Navbar />
          <div className="xl:px-65 lg:px-30 md:px-15 px-5">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
