import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui/components/shadcn/sonner";
import { ThemeProvider } from "@recallnet/ui/components/theme-provider";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontMono.variable} ${fontSans.variable} font-sans antialiased`}
      >
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
