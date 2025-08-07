import { useState } from "react";
import { createSiweMessage, parseSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";

import { useGetNonce, useLogin } from "./useAuth";

/**
 * Custom SIWE authentication hook that integrates ConnectKit with our backend API
 * Manual authentication only - no auto-triggering
 */
export function useSiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const getNonce = useGetNonce();
  const { mutateAsync: login } = useLogin();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const authenticate = async () => {
    if (!address || !chainId || !isConnected) {
      throw new Error("Wallet not connected");
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Get fresh nonce
      const nonceResult = await getNonce();
      const nonce = nonceResult.nonce;

      if (!nonce) {
        throw new Error("Failed to get nonce");
      }

      // Create SIWE message
      const message = createSiweMessage({
        domain: document.location.host,
        address,
        statement: "Sign in with Ethereum to the app.",
        uri: document.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Verify signature with backend
      const siweMessage = parseSiweMessage(message);
      if (!siweMessage.address) {
        throw new Error("No address found in SIWE message");
      }

      await login({
        message,
        signature,
        wallet: siweMessage.address,
      });

      setIsAuthenticating(false);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Authentication failed";

      // Don't log or show errors for user cancellations
      if (
        errorMessage.includes("User rejected") ||
        errorMessage.includes("User denied") ||
        errorMessage.includes("User cancelled") ||
        errorMessage.includes("cancelled") ||
        errorMessage.includes("rejected")
      ) {
        setIsAuthenticating(false);
        setAuthError(null); // Clear any error state
        return false; // Return false instead of throwing
      }

      console.error(`❌ [SIWE] Authentication failed:`, error);
      setAuthError(errorMessage);
      setIsAuthenticating(false);
      throw error;
    }
  };

  return {
    authenticate,
    isAuthenticating,
    authError,
    clearError: () => setAuthError(null),
  };
}
