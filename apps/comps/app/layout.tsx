import "@rainbow-me/rainbowkit/styles.css";
import "@recallnet/ui2/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";

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
