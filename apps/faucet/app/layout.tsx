import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

import { Toaster } from "@recallnet/ui/components/toaster";
import { ThemeProvider } from "@recallnet/ui/recall/theme-provider";

export const metadata: Metadata = {
  title: "Recall Faucet",
  description: "Request RECALL from the Recall faucet",
};

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontMono.variable} font-mono antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          {children}
        </ThemeProvider>
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
