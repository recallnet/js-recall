"use client";

import {
  AuthenticationStatus,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  createAuthenticationAdapter,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { useAtom } from "jotai";
import React from "react";
import { type ReactNode, useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { WagmiProvider } from "wagmi";

import { ThemeProvider } from "@recallnet/ui2/components/theme-provider";

import { userAtom } from "@/state/atoms";
import { clientConfig } from "@/wagmi-config";

const AUTHENTICATION_STATUS: AuthenticationStatus = "unauthenticated";
const CONFIG = clientConfig();

function WalletProvider(props: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [user, setUser] = useAtom(userAtom);

  const authAdapter = React.useMemo(() => {
    return createAuthenticationAdapter({
      getNonce: async () => {
        const { data: res } = await axios<{ nonce: string }>({
          baseURL: "",
          method: "get",
          url: "/api/nonce",
          headers: {
            Accept: "application/json",
          },
          data: null,
        });

        return res.nonce;
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
        const res = await axios<{ ok: boolean; address: string }>({
          baseURL: "",
          method: "post",
          url: "/api/login",
          headers: {
            Accept: "application/json",
          },
          data: { message, signature },
        });

        setUser({ address: res.data.address, loggedIn: true });

        return res.data.ok;
      },
      signOut: async () => {
        console.log("SIGN OUT");
        //await fetch('/api/logout');
      },
    });
  }, [setUser]);
  console.log("SET FUCKING USER", user);

  return (
    <WagmiProvider config={CONFIG}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider
          adapter={authAdapter}
          status={AUTHENTICATION_STATUS}
        >
          <RainbowKitProvider theme={darkTheme()}>
            {props.children}
          </RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
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
