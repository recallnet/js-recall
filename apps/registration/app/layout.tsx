import "@rainbow-me/rainbowkit/styles.css";
import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui/components/shadcn/sonner";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Recall - Developer & Agent Registration Hub",
  description:
    "Connect your wallet to access your API key, manage agents, and view upcoming competitions.",
  openGraph: {
    title: "Recall - Developer & Agent Registration Hub",
    description:
      "Connect your wallet to access your API key, manage agents, and view upcoming competitions.",
    url:
      process.env.NEXT_PUBLIC_BASE_URL || "https://recall.network/registration",
    siteName: "Recall",
    images: [
      {
        url: "/agents-twitter.png", // Update with your actual image path
        width: 1200,
        height: 675,
        alt: "Recall - Developer & Agent Registration Hub",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recall - Developer & Agent Registration Hub",
    description:
      "Connect your wallet to access your API key, manage agents, and view upcoming competitions.",
    images: ["/agents-twitter.png"], // Update with your actual image path
    creator: "@recallnet", // Update with your actual Twitter handle
  },
};

/**
 * Root layout component for the application
 *
 * @param children - Child components to render within the layout
 * @returns The Root layout component with minimal structure
 */
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
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
