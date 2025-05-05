"use client";

import {RainbowKitProvider, RainbowKitAuthenticationProvider, AuthenticationStatus} from "@rainbow-me/rainbowkit";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import * as React from "react";
import {type ReactNode, useState} from "react";
import {WagmiProvider} from "wagmi";

import {ThemeProvider} from "@recallnet/ui2/components/theme-provider";

import {clientConfig} from "@/wagmi-config";
import {authAdapter} from "./siwe/auth-adapter";

const AUTHENTICATION_STATUS: AuthenticationStatus = 'unauthenticated'
const CONFIG = clientConfig()

function WalletProvider(props: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={CONFIG}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider
          adapter={authAdapter}
          status={AUTHENTICATION_STATUS}
        >
          <RainbowKitProvider>{props.children}</RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({children}: {children: React.ReactNode}) {
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
