import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsClient } from "@uidotdev/usehooks";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useDisconnect } from "wagmi";

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
    // Don't cache nonces for too long - they should be fresh for each auth attempt
    staleTime: 0, // Always consider stale
    gcTime: 1000 * 60, // Keep in cache for 1 minute but mark as stale immediately
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
      const result = await apiClient.login(data);
      return result;
    },
    onSuccess: () => {
      setUserAtom({ user: null, status: "authenticated" });

      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // Trigger competitions refetch
      queryClient.invalidateQueries({ queryKey: ["competitions"] });

      // Trigger individual competition refetch (needed for userVotingInfo)
      queryClient.invalidateQueries({ queryKey: ["competition"] });

      // Invalidate nonce cache after successful login
      queryClient.invalidateQueries({ queryKey: ["nonce"] });
    },
    onError: (error) => {
      console.error(`❌ [LOGIN] Login mutation failed:`, error);
      // Invalidate nonce cache after failed login to ensure fresh nonce on retry
      queryClient.invalidateQueries({ queryKey: ["nonce"] });
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
  const { disconnect } = useDisconnect();

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
        // Disconnect wallet to prevent auto re-authentication
        disconnect();
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
      // Still disconnect wallet even if logout fails
      disconnect();
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
