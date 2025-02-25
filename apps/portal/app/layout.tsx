import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Toaster } from "@recallnet/ui/components/toaster";
import { RecallLogo } from "@recallnet/ui/recall/logos/recall-logo";
import { ThemeToggle } from "@recallnet/ui/recall/theme-toggle";
import { Wallet } from "@recallnet/ui/recall/wallet";

import { Providers } from "@/components/providers";

import { Nav } from "./_components/nav";

export const metadata: Metadata = {
  title: "Recall Portal",
  description:
    "Interact with Recall services and discover data stored on the Recall network.",
};

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontMono.variable} font-mono antialiased`}>
        <Analytics />
        <Providers>
          <div className="flex min-h-svh flex-col">
            <div className="border-primary bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 grid grid-cols-3 items-center border-b p-4 backdrop-blur">
              <Nav />
              <div className="flex justify-center">
                <Link href="/">
                  <RecallLogo
                    width={120}
                    height={30}
                    className="fill-primary"
                  />
                </Link>
              </div>
              <div className="flex justify-end gap-4">
                <Wallet />
                <ThemeToggle />
              </div>
            </div>
            <div className="flex flex-1">{children}</div>
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
