import "@recall/ui/globals.css";

import { Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { Toaster } from "@recall/ui/components/toaster";
import { Wallet } from "@recall/ui/recall/wallet";

import { Providers } from "@/components/providers";

import { Nav } from "./_components/nav";

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
        <Providers>
          <div className="flex min-h-svh flex-col">
            <div className="border-primary bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 grid grid-cols-3 items-center border-b p-4 backdrop-blur">
              <Nav />
              <div className="flex justify-center">
                <Link href="/">
                  <Image
                    src="/recall.svg"
                    alt="Recall"
                    width={120}
                    height={30}
                    priority
                  />
                </Link>
              </div>
              <div className="flex justify-end">
                <Wallet />
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
