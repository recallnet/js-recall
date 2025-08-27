import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useIsClient } from "@uidotdev/usehooks";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useEffect, useMemo } from "react";

import { DEFAULT_REDIRECT_URL } from "@/constants";
import { useProfile } from "@/hooks/useProfile";
import { userAtom } from "@/state/atoms";
import { ProfileResponse } from "@/types";

import { usePrivyAuth } from "./usePrivyAuth";

/**
 * Hook to login with wallet
 * @returns Mutation for logging in
 */
export const useLogin = () => {
  const { login } = usePrivyAuth();

  return useMutation({
    mutationFn: async () => {
      login();
      return { success: true };
    },
    onSuccess: () => {
      return { success: true };
    },
    onError: (error) => {
      console.error(`❌ [LOGIN] Login mutation failed:`, error);
      return { success: false };
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

  const { logout } = usePrivyAuth();
  const posthog = usePostHog();

  return useMutation({
    mutationFn: async () => {
      try {
        cleanup();
        // Disconnect wallet to prevent auto re-authentication
        logout();
      } catch (error) {
        // Log API error but proceed with client-side cleanup
        console.error("Logout API call failed:", error);
      }
    },
    onSuccess: () => {
      // Reset PostHog user identity
      posthog.reset();
      router.push(DEFAULT_REDIRECT_URL);
    },
    onError: (error) => {
      console.error(
        "Logout mutation error (after API or during cleanup):",
        error,
      );
      // Still disconnect wallet even if logout fails
      logout();
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
