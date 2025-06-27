"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

import { isMobileDevice } from "@/lib/mobile-utils";

/**
 * Component that enhances mobile wallet behavior
 * Handles mobile-specific WalletConnect issues by reloading after connection
 */
export function MobileWalletEnhancer() {
  const { isConnected, address } = useAccount();
  const prevConnected = useRef(false);

  useEffect(() => {
    // Only apply mobile enhancements on mobile devices
    if (!isMobileDevice()) return;

    // Detect precise false → true transition to avoid flickering issues
    const justConnected = !prevConnected.current && isConnected && address;
    prevConnected.current = isConnected;

    const hasReloadedForWallet = sessionStorage.getItem("wallet-mobile-reload");

    if (justConnected && !hasReloadedForWallet) {
      // Mark that we're about to reload for wallet connection
      sessionStorage.setItem("wallet-mobile-reload", "true");

      // Increased delay to ensure connection state is fully established
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }

    // Clear the reload flag after successful connection and page load
    if (justConnected && hasReloadedForWallet) {
      // Clear the flag after a short delay to allow for signing
      setTimeout(() => {
        sessionStorage.removeItem("wallet-mobile-reload");
      }, 3000);
    }
  }, [isConnected, address]);

  // This component doesn't render anything
  return null;
}
