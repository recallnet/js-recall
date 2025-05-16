import "@recallnet/ui/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { Metadata } from "next";
import { getServerSession } from "next-auth";

import { fontMono, fontSans } from "@recallnet/fonts";
import { Toaster } from "@recallnet/ui/components/shadcn/sonner";

import { Providers } from "@/components/providers";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Recall Agent Registration",
  description:
    "Register as a developer and manage your agent metadata for the Recall network.",
};

/**
 * Root layout component for the application
 *
 * @param children - Child components to render within the layout
 * @returns The Root layout component with minimal structure
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get the session to pass to our client components
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Analytics />
        <Providers session={session}>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
