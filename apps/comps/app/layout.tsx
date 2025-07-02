import "@rainbow-me/rainbowkit/styles.css";
import "@recallnet/ui2/globals.css";

import { Metadata } from "next";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui2/components/toast";

import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import { Tracking } from "@/components/tracking";

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
        className={`${fontSans.variable} ${fontMono.variable} overflow-x-hidden bg-black antialiased`}
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
