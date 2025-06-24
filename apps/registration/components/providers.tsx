"use client";

import {
  AuthenticationStatus,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  createAuthenticationAdapter,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationGuardProvider } from "next-navigation-guard";
import React from "react";
import { type ReactNode, useState } from "react";
import { createSiweMessage, parseSiweMessage } from "viem/siwe";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@recallnet/ui/components/theme-provider";

import { useLogin, useLogout, useNonce } from "@/hooks/useAuth";
import { clientConfig } from "@/wagmi-config";

const AUTHENTICATION_STATUS: AuthenticationStatus = "unauthenticated";
const CONFIG = clientConfig();

function WalletProvider(props: { children: ReactNode }) {
  const { data: nonceData, refetch: refetchNonce } = useNonce();
  const { mutateAsync: login } = useLogin();
  const { mutateAsync: logout } = useLogout();

  const authAdapter = React.useMemo(() => {
    return createAuthenticationAdapter({
      getNonce: async () => {
        // If we don't have nonce data, refetch it
        if (!nonceData?.nonce) {
          const result = await refetchNonce();
          return result.data?.nonce ?? "";
        }
        return nonceData.nonce;
      },
      createMessage: ({ nonce, address, chainId }) => {
        return createSiweMessage({
          domain: document.location.host,
          address,
          statement: "Sign in with Ethereum to the app.",
          uri: document.location.origin,
          version: "1",
          chainId,
          nonce,
        });
      },
      verify: async ({ message, signature }) => {
        const siweMessage = parseSiweMessage(message);
        if (!siweMessage.address) {
          throw new Error("No address found in SIWE message");
        }

        await login({
          message,
          signature,
          wallet: siweMessage.address,
        });

        return true;
      },
      signOut: async () => {
        await logout();
      },
    });
  }, [nonceData, refetchNonce, login, logout]);

  return (
    <WagmiProvider config={CONFIG}>
      <RainbowKitAuthenticationProvider
        adapter={authAdapter}
        status={AUTHENTICATION_STATUS}
      >
        <RainbowKitProvider theme={darkTheme()}>
          {props.children}
        </RainbowKitProvider>
      </RainbowKitAuthenticationProvider>
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
