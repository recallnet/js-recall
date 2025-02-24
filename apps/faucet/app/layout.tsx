import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";

import { Toaster } from "@recallnet/ui/components/toaster";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recall Faucet",
  description: "Request RECALL from the Recall faucet",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceMono.className} antialiased`}>
        {children}
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
