"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Session } from "next-auth";
import { signIn, signOut, useSession } from "next-auth/react";
import { useCallback } from "react";
import { useAccount } from "wagmi";

// Extend the Session type to include address
interface ExtendedSession extends Session {
  address: string;
}

/**
 * Custom hook to manage authentication state
 *
 * Combines NextAuth session and wallet connection state to provide a unified auth state
 *
 * @returns {Object} Auth state and methods
 */
export function useAuthState() {
  const { status, data: session } = useSession();
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();

  // Type cast the session to use our extended type
  const extendedSession = session as ExtendedSession | null;

  const isLoading = status === "loading";
  const isAuthenticated =
    status === "authenticated" && !!extendedSession?.address;

  /**
   * Trigger the sign-in process manually
   * This can be used when the wallet is connected but the user isn't authenticated
   */
  const triggerSignIn = useCallback(async () => {
    try {
      console.log("Manually triggering signIn...");
      const result = await signIn("siwe", { redirect: false });
      console.log("Sign in result:", result);
      return result;
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }, []);

  /**
   * Sign out the user and disconnect wallet if needed
   */
  const logout = useCallback(async () => {
    try {
      await signOut({ redirect: false });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  return {
    isLoading,
    isConnected,
    isAuthenticated,
    address: isAuthenticated ? extendedSession?.address : address,
    user: session?.user,
    triggerSignIn,
    logout,
    openConnectModal,
  };
}
