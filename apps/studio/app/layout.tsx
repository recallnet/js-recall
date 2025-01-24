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
            <div className="border-primary sticky top-0 grid grid-cols-3 items-center border-b p-3 bg-background">
              <Nav />
              <div className="flex justify-center">
                <Link href="/">
                  <Image
                    src="/recall.svg"
                    alt="Recall"
                    width={120}
                    height={30}
                  />
                </Link>
              </div>
              <div className="flex justify-end">
                <Wallet />
              </div>
            </div>
            <div className="flex-1 p-2">{children}</div>
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
