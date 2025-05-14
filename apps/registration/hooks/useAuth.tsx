"use client";

import { useCallback, useEffect, useState } from "react";
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
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSignInAttempted, setAutoSignInAttempted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [logoutCooldown, setLogoutCooldown] = useState(false);

  // Clear permission denied state when address changes
  useEffect(() => {
    if (address) {
      setPermissionDenied(false);
    }
  }, [address]);

  // Check authentication status on mount and when wallet changes
  useEffect(() => {
    checkAuthStatus();
  }, [address]);

  // Auto-sign in when wallet connects
  useEffect(() => {
    async function attemptAutoSignIn() {
      // Don't attempt auto sign-in during logout cooldown
      if (logoutCooldown) {
        return;
      }

      // Don't attempt auto sign-in if user has previously denied permission for this session
      if (permissionDenied) {
        return;
      }

      // Only attempt auto sign-in if we're connected, not already authenticated,
      // and haven't attempted auto sign-in for this connection yet
      if (
        isConnected &&
        !isAuthenticated &&
        !isLoading &&
        !autoSignInAttempted &&
        address
      ) {
        try {
          setAutoSignInAttempted(true);
          await signIn();
        } catch (error) {
          // Check for permission denial errors
          if (
            error instanceof Error &&
            (error.message.includes("User denied") ||
              error.message.includes("UnauthorizedProviderError") ||
              error.message.includes(
                "account and/or method has not been authorized",
              ))
          ) {
            // Mark permission as denied for this session to prevent repeated prompts
            setPermissionDenied(true);
          } else if (
            error instanceof Error &&
            error.message.includes("Connector not connected")
          ) {
            // Reset for connector issues only
            setAutoSignInAttempted(false);
          }
        }
      }
    }

    // Reset auto sign-in attempted flag when disconnected
    if (!isConnected) {
      setAutoSignInAttempted(false);
    } else {
      attemptAutoSignIn();
    }
  }, [
    isConnected,
    isAuthenticated,
    isLoading,
    address,
    autoSignInAttempted,
    permissionDenied,
    logoutCooldown,
  ]);

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
      setError("Failed to check authentication status");
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to handle sign-in
  const signIn = useCallback(async () => {
    // Don't try to sign in during cooldown
    if (logoutCooldown) {
      return false;
    }

    if (!address) {
      setError("No wallet connected");
      return false;
    }

    try {
      setIsLoading(true);
      setIsSigningIn(true);
      setError(null);

      // Check if connector is still connected
      if (!isConnected) {
        setError("Wallet disconnected");
        setIsSigningIn(false);
        return false;
      }

      // Get a nonce
      const nonce = await getNonce();
      if (!nonce) {
        setError("Failed to get authentication nonce");
        setIsSigningIn(false);
        return false;
      }

      // Create a message to sign
      const message = createSiweMessage(address, nonce);

      // Sign the message
      try {
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
          setIsSigningIn(false);
          return true;
        } else {
          setError(result.error || "Authentication failed");
          setIsSigningIn(false);
          return false;
        }
      } catch (signError) {
        // Handle specific MetaMask/wallet errors
        setIsSigningIn(false);

        if (signError instanceof Error) {
          if (
            signError.message.includes("User denied message signature") ||
            signError.message.includes("UnauthorizedProviderError") ||
            signError.message.includes(
              "account and/or method has not been authorized",
            )
          ) {
            setError(
              "Signature request rejected. Please approve the signature request in your wallet.",
            );
            setAutoSignInAttempted(true); // Prevent auto retry if user denied
            setPermissionDenied(true); // Mark as denied
          } else if (signError.message.includes("Connector not connected")) {
            // Give the connector time to stabilize
            setTimeout(() => {
              setAutoSignInAttempted(false);
            }, 1000);
          } else {
            setError(`Error: ${signError.message}`);
          }
        } else {
          setError("Failed to sign message");
        }
        return false;
      }
    } catch (err) {
      setIsSigningIn(false);

      // Handle connector errors specifically
      if (err instanceof Error) {
        if (err.message.includes("Connector not connected")) {
          setError("Wallet connection lost. Please reconnect your wallet.");
          // Give the connector time to stabilize
          setTimeout(() => {
            setAutoSignInAttempted(false);
          }, 1000);
        } else if (
          err.message.includes("UnauthorizedProviderError") ||
          err.message.includes("account and/or method has not been authorized")
        ) {
          setError(
            "Wallet permission denied. Please approve the connection request in your wallet.",
          );
          setPermissionDenied(true); // Mark as denied
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError("Failed to sign in");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, logoutCooldown, signMessageAsync, checkAuthStatus]);

  // Function to handle logout
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Immediately reset auto sign-in flag to prevent auto sign-in attempts during logout
      setAutoSignInAttempted(false);
      setPermissionDenied(false);
      setIsSigningIn(false);
      // Set cooldown to prevent immediate sign-in after logout
      setLogoutCooldown(true);

      const success = await authLogout();

      if (success) {
        // First clear local state
        setIsAuthenticated(false);
        setWallet(null);
        setTeamId(null);
        setIsAdmin(false);

        // Brief delay to let Wagmi's connector state update
        setTimeout(() => {
          setIsLoading(false);
          // Reset cooldown after a longer delay to ensure connector state is fully settled
          setTimeout(() => {
            setLogoutCooldown(false);
          }, 2000);
        }, 500);

        return true;
      } else {
        setError("Logout failed");
        setLogoutCooldown(false);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log out");
      setLogoutCooldown(false);
      return false;
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
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
    isSigningIn,
  };
}
