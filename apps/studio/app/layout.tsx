import { Geist_Mono } from "next/font/google";

import "@recall/ui/globals.css";
import { Providers } from "@/components/providers";
import { Wallet } from "@recall/ui/recall/wallet";
import Image from "next/image";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recall/ui/components/dropdown-menu";
import { Toaster } from "@recall/ui/components/toaster";

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
            <div className="border-primary sticky top-0 grid grid-cols-3 items-center border-b p-3">
              <div className="flex items-center gap-6">
                <DropdownMenu>
                  <DropdownMenuTrigger className="md:hidden">
                    <Menu />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="ml-2">
                    <DropdownMenuItem>Agents</DropdownMenuItem>
                    <DropdownMenuItem>Buckets</DropdownMenuItem>
                    <DropdownMenuItem>Docs</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="hidden gap-6 md:flex">
                  <span>Agents</span>
                  <span>Buckets</span>
                  <span>Docs</span>
                </div>
              </div>
              <div className="flex justify-center">
                <Image src="/recall.svg" alt="Recall" width={120} height={30} />
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
