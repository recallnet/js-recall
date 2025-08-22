"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationGuardProvider } from "next-navigation-guard";
import React from "react";
import { useState } from "react";

import { ThemeProvider } from "@recallnet/ui2/components/theme-provider";

import { PostHogProviderWrapper } from "./posthog-provider";
import { PrivyProviderWrapper } from "./privy-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, //keep data for 5min
            gcTime: 30 * 60 * 1000, //keep in cache after components unmount
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <QueryClientProvider client={queryClient}>
        <PostHogProviderWrapper>
          <PrivyProviderWrapper>
            <NavigationGuardProvider>{children}</NavigationGuardProvider>
          </PrivyProviderWrapper>
        </PostHogProviderWrapper>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
