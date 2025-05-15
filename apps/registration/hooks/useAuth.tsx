"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

import {
  logout as authLogout,
  authenticateWithSignature,
  createSiweMessage,
  getAuthStatus,
  getNonce,
} from "@/lib/auth";

/**
 * Authentication hook
 *
 * Provides methods and state for authentication
 */
export function useAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSignInAttempted, setAutoSignInAttempted] = useState(false);

  // Keep track of the previously connected wallet to detect changes
  const previousWalletRef = useRef<string | null | undefined>(null);

  // Reset auto sign-in flag when wallet changes
  useEffect(() => {
    // If address changed, reset autoSignInAttempted
    if (address !== previousWalletRef.current) {
      setAutoSignInAttempted(false);
      previousWalletRef.current = address;
    }
  }, [address]);

  // Auto-sign in when wallet connects
  useEffect(() => {
    async function attemptAutoSignIn() {
      try {
        setIsLoading(true);
        setError(null);

        const status = await getAuthStatus();

        setIsAuthenticated(status.isAuthenticated);
        setWallet(status.wallet);
        setTeamId(status.teamId);
        setIsAdmin(status.isAdmin);
      } catch (err) {
        console.error("Error checking auth status:", err);
        setError("Failed to check authentication status");
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }

      // Trigger sign-in if we have an address, not authenticated, and haven't attempted yet
      if (address && !isAuthenticated && !autoSignInAttempted) {
        setAutoSignInAttempted(true);
        await signIn();
      }
    }

    attemptAutoSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, autoSignInAttempted, isAuthenticated]);

  // Function to check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const status = await getAuthStatus();

      setIsAuthenticated(status.isAuthenticated);
      setWallet(status.wallet);
      setTeamId(status.teamId);
      setIsAdmin(status.isAdmin);
    } catch (err) {
      console.error("Error checking auth status:", err);
      setError("Failed to check authentication status");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to handle sign-in
  const signIn = useCallback(async () => {
    if (!address) {
      setError("No wallet connected");
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get a nonce
      const nonce = await getNonce();
      if (!nonce) {
        setError("Failed to get authentication nonce");
        return false;
      }

      // Create a message to sign
      const message = createSiweMessage(address, nonce);

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Authenticate with the signature
      const result = await authenticateWithSignature(
        address,
        signature,
        message,
      );

      if (result.success) {
        setIsAuthenticated(true);
        setWallet(result.wallet);
        setTeamId(result.teamId);

        // Refresh auth status to get complete user data
        await checkAuthStatus();
        return true;
      } else {
        setError(result.error || "Authentication failed");
        return false;
      }
    } catch (err) {
      console.error("Error during sign-in:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync, checkAuthStatus]);

  // Function to handle logout
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await authLogout();

      if (success) {
        setIsAuthenticated(false);
        setWallet(null);
        setTeamId(null);
        setIsAdmin(false);
        // Don't reset autoSignInAttempted here, it will be reset when wallet changes
        return true;
      } else {
        setError("Logout failed");
        return false;
      }
    } catch (err) {
      console.error("Error during logout:", err);
      setError(err instanceof Error ? err.message : "Failed to log out");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAuthenticated,
    wallet,
    teamId,
    isAdmin,
    isLoading,
    error,
    signIn,
    logout,
    checkAuthStatus,
    autoSignInAttempted,
  };
}
