"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { NavigationGuardProvider } from "next-navigation-guard";
import React from "react";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@recallnet/ui2/components/theme-provider";

import { clientConfig } from "@/wagmi-config";

const CONFIG = clientConfig();

function WalletProvider(props: { children: ReactNode }) {
  return (
    <WagmiProvider config={CONFIG}>
      <ConnectKitProvider
        mode="dark"
        customTheme={{
          "--ck-connectbutton-font-size": "14px",
          "--ck-connectbutton-border-radius": "0px",
          "--ck-connectbutton-background": "#0057AD",
          "--ck-connectbutton-background-hover": "#0066cc",
          "--ck-font-family": "'Trim Mono', monospace",
        }}
        options={{
          initialChainId: 0, // Let it auto-detect
        }}
      >
        {props.children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <NavigationGuardProvider>{children}</NavigationGuardProvider>
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
