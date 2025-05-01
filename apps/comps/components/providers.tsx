"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@recallnet/ui2/components/theme-provider";

import { config } from "@/wagmi-config";

function WalletProvider(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <WalletProvider>{children}</WalletProvider>
    </ThemeProvider>
  );
}
