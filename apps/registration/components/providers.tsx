"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
 * - RainbowKitProvider for wallet UI
 * - ThemeProvider for theming support
 *
 * @param props Component props
 * @returns Provider-wrapped children
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </WagmiProvider>
  );
}
