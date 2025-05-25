"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { RainbowKitSiweNextAuthProvider } from "@rainbow-me/rainbowkit-siwe-next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import * as React from "react";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@recallnet/ui/components/theme-provider";

import { config } from "@/lib/wagmi-config";

const queryClient = new QueryClient();

/**
 * Providers component that wraps the application with necessary context providers
 *
 * This includes:
 * - WagmiProvider for wallet connections
 * - QueryClientProvider for data fetching
 * - SessionProvider for NextAuth session management
 * - RainbowKitSiweNextAuthProvider for Sign In With Ethereum
 * - RainbowKitProvider for wallet UI
 * - ThemeProvider for theming support
 *
 * @param props Component props
 * @returns Provider-wrapped children
 */
export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider refetchInterval={5} session={session}>
          <RainbowKitSiweNextAuthProvider enabled={true}>
            <RainbowKitProvider
              theme={darkTheme({
                borderRadius: "none",
                fontStack: "system",
              })}
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
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
