import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsClient } from "@uidotdev/usehooks";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEffect, useMemo } from "react";
import { createSiweMessage, parseSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";

import { DEFAULT_REDIRECT_URL } from "@/constants";
import { useProfile } from "@/hooks/useProfile";
import { ApiClient } from "@/lib/api-client";
import { userAtom } from "@/state/atoms";
import { LoginRequest, ProfileResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to get a nonce for signature
 * @returns Query result with nonce data
 */
export const useNonce = () => {
  return useQuery({
    queryKey: ["nonce"],
    queryFn: async () => {
      return apiClient.getNonce();
    },
  });
};

/**
 * Hook to login with wallet
 * @returns Mutation for logging in
 */
export const useLogin = () => {
  const queryClient = useQueryClient();
  const [, setUserAtom] = useAtom(userAtom);

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      return apiClient.login(data);
    },
    onSuccess: () => {
      setUserAtom({ user: null, status: "authenticated" });

      // Trigger profile refetch
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // Trigger competitions refetch
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
  });
};

/**
 * Hook to perform client-side cleanup when user is logged out or unauthorized
 * @returns Function to perform cleanup
 */
export const useClientCleanup = () => {
  const queryClient = useQueryClient();
  const [, setUserAtom] = useAtom(userAtom);

  return () => {
    // Clear all queries from cache
    queryClient.clear();
    setUserAtom({ user: null, status: "unauthenticated" });
  };
};

/**
 * Hook to logout
 * @returns Mutation for logging out
 */
export const useLogout = () => {
  const router = useRouter();
  const cleanup = useClientCleanup();

  return useMutation({
    mutationFn: async () => {
      try {
        // Call the logout API first
        await apiClient.logout();
      } catch (error) {
        // Log API error but proceed with client-side cleanup
        console.error("Logout API call failed:", error);
      } finally {
        cleanup();
      }
    },
    onSuccess: () => {
      router.push(DEFAULT_REDIRECT_URL);
    },
    onError: (error) => {
      console.error(
        "Logout mutation error (after API or during cleanup):",
        error,
      );
      router.push(DEFAULT_REDIRECT_URL);
    },
  });
};

/**
 * Represents the state of the user session as returned by useUserSession.
 *
 * This is a discriminated union:
 * - When `isInitialized` is false, only `isInitialized` is available.
 * - When `isInitialized` is true, all session fields are available.
 *
 * Consumers **must** check `isInitialized` before using other fields.
 */
export type UserSessionState =
  | {
      /** Indicates if the session state has been initialized on the client. */
      isInitialized: false;
    }
  | {
      /** Indicates if the session state has been initialized on the client. */
      isInitialized: true;
      /** The user profile, or null if not authenticated. */
      user: ProfileResponse["user"] | null;
      /** True if the user is authenticated. */
      isAuthenticated: boolean;
      /** True if the user's profile is updated (e.g., has a name). */
      isProfileUpdated: boolean;
      /** Indicates if the profile is loading. */
      isLoading: boolean;
    };

export const useUserSession = (): UserSessionState => {
  const [authState, setAuthState] = useAtom(userAtom);
  const isClient = useIsClient();

  const {
    data: profileData,
    isSuccess: profileIsSuccess,
    isLoading: profileIsLoading,
  } = useProfile();

  const isAuthenticated = authState.status === "authenticated";
  const isProfileUpdated = isAuthenticated && !!profileData?.name;

  useEffect(() => {
    if (profileIsSuccess && profileData) {
      setAuthState({ user: profileData, status: "authenticated" });
    }
  }, [profileIsSuccess, profileData, setAuthState]);

  const sessionState = useMemo<UserSessionState>(() => {
    if (!isClient) {
      return { isInitialized: false };
    }

    return {
      isInitialized: true,
      user: authState.user,
      isAuthenticated,
      isProfileUpdated,
      isLoading: profileIsLoading,
    };
  }, [
    isClient,
    authState.user,
    isAuthenticated,
    isProfileUpdated,
    profileIsLoading,
  ]);

  return sessionState;
};

/**
 * Custom SIWE authentication hook that integrates ConnectKit with our backend API
 * Manual authentication only - no auto-triggering
 */
export function useSiweAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { refetch: refetchNonce } = useNonce();
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
      const nonceResult = await refetchNonce();
      const nonce = nonceResult.data?.nonce;

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
      console.log(`❌ [SIWE] Authentication failed:`, error);
      setAuthError(
        error instanceof Error ? error.message : "Authentication failed",
      );
      setIsAuthenticating(false);
    }
  };

  return {
    authenticate,
    isAuthenticating,
    authError,
    clearError: () => setAuthError(""),
  };
}
