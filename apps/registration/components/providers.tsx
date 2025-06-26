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

// Mobile detection utility
const isMobile = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

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
          // Add mobile-friendly metadata for better deep linking
          requestId: crypto.randomUUID(),
          issuedAt: new Date(),
          expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          // Add resources for mobile wallet compatibility
          resources: [
            document.location.origin,
            "https://register.recall.network",
          ],
        });
      },
      verify: async ({ message, signature }) => {
        const siweMessage = parseSiweMessage(message);
        if (!siweMessage.address) {
          throw new Error("No address found in SIWE message");
        }

        try {
          await login({
            message,
            signature,
            wallet: siweMessage.address,
          });

          // Enhanced mobile focus management based on research
          if (isMobile() && typeof window !== "undefined") {
            // Add visibility change listener for better mobile app switching
            const handleVisibilityChange = () => {
              if (document.visibilityState === "visible") {
                // App came back to foreground after wallet interaction
                document.removeEventListener(
                  "visibilitychange",
                  handleVisibilityChange,
                );
              }
            };

            document.addEventListener(
              "visibilitychange",
              handleVisibilityChange,
            );

            // Multiple focus strategies for different mobile browsers
            setTimeout(() => {
              window.focus();
              // Try to trigger a scroll to bring attention back to the app
              window.scrollTo(0, 0);
            }, 100);
          }

          return true;
        } catch (error) {
          console.error("SIWE verification failed:", error);
          // Enhanced error logging for debugging mobile issues
          if (isMobile()) {
            console.error("Mobile SIWE verification error details:", {
              userAgent: navigator.userAgent,
              message: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
              visibilityState: document.visibilityState,
            });
          }
          throw error;
        }
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
        <RainbowKitProvider theme={darkTheme()} modalSize="compact" coolMode>
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
