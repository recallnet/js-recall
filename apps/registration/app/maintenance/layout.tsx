import "@recallnet/ui/globals.css";

import { Metadata } from "next";

import { fontMono, fontSans } from "@recallnet/fonts";

export const metadata: Metadata = {
  title: "Maintenance - Recall",
  description:
    "We're currently performing scheduled maintenance. Please check back soon.",
  openGraph: {
    title: "Maintenance - Recall",
    description:
      "We're currently performing scheduled maintenance. Please check back soon.",
    url:
      process.env.NEXT_PUBLIC_BASE_URL || "https://registration.recall.network",
    siteName: "Recall",
    images: [
      {
        url: "/agents-twitter.png",
        width: 1200,
        height: 675,
        alt: "Recall - Down for Maintenance",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Maintenance - Recall",
    description:
      "We're currently performing scheduled maintenance. Please check back soon.",
    images: ["/agents-twitter.png"],
    creator: "@recallnet",
  },
};

/**
 * Maintenance layout component - simplified layout without providers
 *
 * @param children - Child components to render within the layout
 * @returns The maintenance layout component
 */
export default function MaintenanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
