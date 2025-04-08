import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";
import Link from "next/link";

import { fontMono, fontSans } from "@recallnet/fonts";
import { RecallLogo } from "@recallnet/ui/components/logos/recall-logo";
import { Toaster } from "@recallnet/ui/components/shadcn/toaster";
import { ThemeToggle } from "@recallnet/ui/components/theme-toggle";
import { Wallet } from "@recallnet/ui/components/wallet";

import { Providers } from "@/components/providers";

import { Nav } from "./_components/nav";

export const metadata: Metadata = {
  title: "Recall Portal",
  description:
    "Interact with Recall services and discover data stored on the Recall network.",
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
