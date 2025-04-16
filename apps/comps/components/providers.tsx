"use client";

import * as React from "react";

import { ThemeProvider } from "@recallnet/ui2/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      {children}
    </ThemeProvider>
  );
}
