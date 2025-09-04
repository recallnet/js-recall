import {
  LinkedAccountWithMetadata,
  User as PrivyUser,
  WalletWithMetadata,
  useLinkAccount,
  useLogin,
  useLogout,
  usePrivy,
} from "@privy-io/react-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAnalytics } from "@/hooks/usePostHog";
import { apiClient } from "@/lib/api-client";
import { userAtom } from "@/state/atoms";

// Note: the officially exported `PrivyErrorCode` type cannot be used, so we type a subset
enum PrivyErrorCode {
  USER_EXITED_AUTH_FLOW = "exited_auth_flow",
  USER_EXITED_LINK_FLOW = "exited_link_flow",
  CANNOT_LINK_MORE_OF_TYPE = "cannot_link_more_of_type",
  MUST_BE_AUTHENTICATED = "must_be_authenticated",
}

/**
 * Check if a Privy user is set up with a custom linked wallet. Custom linked wallets are linked
 * accounts with a wallet client type that is not "privy" (i.e., not an embedded wallet).
 * @param wallet - The linked account to check.
 * @returns True if the linked account is a custom linked wallet, false otherwise. If the user is not
 * set up with a custom linked wallet, returns false.
 */
function isCustomLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType !== "privy";
}

/**
 * Get the custom linked wallet from a Privy user.
 * @param privyUser - The Privy user to get the custom linked wallet from.
 * @returns The custom linked wallet, or undefined if no custom linked wallet is found.
 */
export function getCustomLinkedWallets(
  privyUser: PrivyUser,
): WalletWithMetadata[] {
  const customWallets = privyUser.linkedAccounts.filter(isCustomLinkedWallet);
  // Transform wallet address to lowercase for db comparison reasons
  return customWallets.map((wallet) => ({
    ...wallet,
    address: wallet.address.toLowerCase(),
  }));
}

// Global state to prevent multiple login attempts across hook instances
const globalLoginState = {
  loginInProgress: false,
  backendLoginInProgress: false,
  walletLinkingInProgress: false,
  walletBackendLinkingInProgress: false,
};

/**
 * Custom Privy authentication hook for profile sync with backend
 */
export function usePrivyAuth() {
  const { user: privyUser, authenticated, ready } = usePrivy();
  const queryClient = useQueryClient();
  const [userState, setUserAtom] = useAtom(userAtom);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { trackEvent } = useAnalytics();
  const posthog = usePostHog();

  // Promise control to allow awaiting the Privy link flow
  const linkWalletPromiseRef = useRef<{
    resolve: (value: string | null) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  const { linkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      // Reset wallet linking flag immediately
      globalLoginState.walletLinkingInProgress = false;

      const walletAddress = (
        linkedAccount as WalletWithMetadata
      ).address.toLowerCase();

      // Resolve the promise for any awaiting caller
      if (linkWalletPromiseRef.current) {
        linkWalletPromiseRef.current.resolve(walletAddress);
        linkWalletPromiseRef.current = null;
      }

      // Only persist to backend if we're already authenticated
      if (userState.status === "authenticated") {
        // Prevent multiple backend wallet linking calls
        if (globalLoginState.walletBackendLinkingInProgress) {
          return;
        }

        globalLoginState.walletBackendLinkingInProgress = true;
        try {
          const result = await apiClient.linkWallet({ walletAddress });
          if (result.success && result.user) {
            setUserAtom({ user: result.user, status: "authenticated" });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
        } catch (error) {
          setAuthError(
            error instanceof Error ? error.message : "Failed to link wallet",
          );
        } finally {
          globalLoginState.walletBackendLinkingInProgress = false;
        }
      } else {
        // If not authenticated yet, trigger the backend login flow

        // Reset the login progress flag to allow the flow to continue
        globalLoginState.loginInProgress = false;
        globalLoginState.walletLinkingInProgress = false;

        // The user's linkedAccounts have been updated by Privy
        // The next time onComplete runs, it will see the wallet and proceed with login
      }
    },
    onError: async (error) => {
      // If user is in pending state and exits link flow, continue with login without wallet
      if (
        error === PrivyErrorCode.USER_EXITED_LINK_FLOW &&
        userState.status === "pending"
      ) {
        // Reset flags
        globalLoginState.loginInProgress = false;
        globalLoginState.backendLoginInProgress = true;

        try {
          // Complete backend login without wallet
          const result = await apiClient.login();

          // Identify user in analytics
          posthog.identify(result.userId);
          trackEvent("UserLoggedIn");

          // Fetch profile and update state
          const profileResult = await apiClient.getProfile();
          if (profileResult.success && profileResult.user) {
            setUserAtom({
              user: profileResult.user,
              status: "authenticated",
            });
            queryClient.setQueryData(["profile"], profileResult.user);
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          } else {
            throw new Error("Failed to fetch user profile after login");
          }
        } catch (loginError) {
          setAuthError(
            loginError instanceof Error ? loginError.message : "Login failed",
          );
          setUserAtom({ user: null, status: "unauthenticated" });
        } finally {
          globalLoginState.backendLoginInProgress = false;
          setIsAuthenticating(false);
        }

        // Reset wallet linking flag
        globalLoginState.walletLinkingInProgress = false;

        // Resolve promise with null for cancellations
        if (linkWalletPromiseRef.current) {
          linkWalletPromiseRef.current.resolve(null);
          linkWalletPromiseRef.current = null;
        }
        return;
      }

      if (
        error === PrivyErrorCode.CANNOT_LINK_MORE_OF_TYPE ||
        error === PrivyErrorCode.MUST_BE_AUTHENTICATED
      ) {
        // For other wallet linking cases, just reset the state
        setIsAuthenticating(false);
        globalLoginState.loginInProgress = false;
        globalLoginState.walletLinkingInProgress = false;
        setAuthError(null);

        // Resolve promise with null for cancellations
        if (linkWalletPromiseRef.current) {
          linkWalletPromiseRef.current.resolve(null);
          linkWalletPromiseRef.current = null;
        }
        return;
      }

      // Handle actual errors
      setIsAuthenticating(false);
      globalLoginState.loginInProgress = false;
      globalLoginState.walletLinkingInProgress = false;
      setAuthError("Failed to link wallet");

      // Reject promise for actual errors
      if (linkWalletPromiseRef.current) {
        linkWalletPromiseRef.current.reject(error);
        linkWalletPromiseRef.current = null;
      }
    },
  });

  // Use Privy's useLogin hook with proper callback handling
  const { login: privyLogin } = useLogin({
    onComplete: async ({ user: privyUser }) => {
      // We don't have the backend user yet, but we've completed email auth
      // Mark that we're potentially waiting for wallet linking
      setUserAtom({ user: null, status: "pending" });
      // Prevent multiple onComplete executions during the same login flow
      if (globalLoginState.loginInProgress) {
        return;
      }
      globalLoginState.loginInProgress = true;

      try {
        // Step 1: Check if user needs to link a wallet before login
        const privyLinkedWallets = getCustomLinkedWallets(privyUser);

        // If there are no custom linked wallets, prompt user to link wallet before backend login
        // TODO: this is temporary as part of the profile migration. i.e., our ideal state is email
        // first, and custom wallets are for the crypto savvy (via linking it in their profile).
        // But, we try to coerce legacy users to link the wallet during onboarding so that we can
        // search for their existing account.
        if (privyLinkedWallets.length === 0) {
          // Check if wallet linking is already in progress
          if (!globalLoginState.walletLinkingInProgress) {
            globalLoginState.walletLinkingInProgress = true;

            // Schedule the wallet linking after the current execution context
            // This allows Privy to properly complete the login flow first
            setTimeout(() => {
              linkWallet();
              // The walletLinkingInProgress flag will be reset in the onSuccess or onError callbacks
            }, 100);
          }

          // Exit early - the useEffect will handle backend login once wallet is linked
          globalLoginState.loginInProgress = false;
          return;
        }

        // Step 2: Complete backend login
        const result = await apiClient.login();
        posthog.identify(result.userId, { wallet: result.wallet });
        trackEvent("UserLoggedIn");

        // Step 3: Fetch profile data and set authenticated state
        const profileResult = await apiClient.getProfile();
        if (!profileResult.success || !profileResult.user) {
          throw new Error("Failed to fetch user profile after login");
        }

        // Step 4: Update state - user is now authenticated
        setUserAtom({ user: profileResult.user, status: "authenticated" });
        queryClient.setQueryData(["profile"], profileResult.user);

        // Force profile query to recognize the new data
        queryClient.invalidateQueries({
          queryKey: ["profile"],
          refetchType: "none",
        });

        // Step 6: We've already prompted for wallet linking at the beginning if needed
        // Don't prompt again here as Privy's auth state might not be ready yet

        // Invalidate queries to refresh other data
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["user-competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competition"] });

        setIsAuthenticating(false);
        setAuthError(null);

        // Small delay to ensure React processes state updates
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Reset login in progress flag
        globalLoginState.loginInProgress = false;

        return true;
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Authentication failed",
        );
        setIsAuthenticating(false);

        // Reset to unauthenticated on error
        setUserAtom({ user: null, status: "unauthenticated" });

        // Reset login in progress flag
        globalLoginState.loginInProgress = false;
      }
    },
    onError: (error) => {
      const errorMessage = String(error) || "Authentication failed";

      // Don't show errors for user cancellations
      if (error === PrivyErrorCode.USER_EXITED_AUTH_FLOW) {
        setIsAuthenticating(false);
        setAuthError(null);

        // Reset global state even on cancellation
        globalLoginState.loginInProgress = false;
        globalLoginState.backendLoginInProgress = false;
        globalLoginState.walletLinkingInProgress = false;
        globalLoginState.walletBackendLinkingInProgress = false;
        return;
      }

      setAuthError(errorMessage);
      setIsAuthenticating(false);

      // Reset to unauthenticated on Privy login failure
      setUserAtom({ user: null, status: "unauthenticated" });

      // Reset global state
      globalLoginState.loginInProgress = false;
      globalLoginState.backendLoginInProgress = false;
      globalLoginState.walletLinkingInProgress = false;
      globalLoginState.walletBackendLinkingInProgress = false;
    },
  });

  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      setUserAtom({ user: null, status: "unauthenticated" });
      queryClient.clear();

      // Reset global state
      globalLoginState.loginInProgress = false;
      globalLoginState.backendLoginInProgress = false;
      globalLoginState.walletLinkingInProgress = false;
      globalLoginState.walletBackendLinkingInProgress = false;
    },
  });

  // Legacy profile fetch mutation - kept for backward compatibility but not used in main flow
  const profileFetchMutation = useMutation({
    mutationFn: async () => {
      return apiClient.getProfile();
    },
    onSuccess: (data) => {
      // Update user atom with profile data
      if (data.success && data.user) {
        setUserAtom({ user: data.user, status: "authenticated" });
      } else {
        // If profile fetch fails, keep current user data but stay authenticated
        // This prevents flicker when profile data is temporarily unavailable
        setUserAtom({ user: userState.user, status: "authenticated" });
      }

      // Trigger profile refetch to get updated user data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition"] });
    },
    onError: (error) => {
      setAuthError(
        error instanceof Error ? error.message : "Profile fetch failed",
      );
    },
  });

  // Login function - now just triggers Privy modal, actual backend auth happens in onComplete callback
  const login = useCallback(() => {
    if (!ready) {
      throw new Error("Privy not ready");
    }

    setIsAuthenticating(true);
    setAuthError(null);

    // Trigger Privy login modal - onComplete callback will handle backend authentication
    privyLogin();
  }, [privyLogin, ready]);

  // Logout function - now just triggers Privy logout, cleanup happens in onSuccess callback
  const logout = useCallback(() => {
    privyLogout();
  }, [privyLogout]);

  // Store mutation function in a ref to maintain stable reference
  const mutateAsyncRef = useRef(profileFetchMutation.mutateAsync);
  mutateAsyncRef.current = profileFetchMutation.mutateAsync;

  // Clear stale errors once authenticated to avoid repeated UI toasts across pages
  useEffect(() => {
    if (authenticated) {
      setAuthError(null);
    }
  }, [authenticated]);

  // Watch for changes in linked accounts and complete login if needed
  useEffect(() => {
    if (userState.status !== "pending") {
      return;
    }
    if (!privyUser) {
      return;
    }

    const customWallets = getCustomLinkedWallets(privyUser);
    if (
      customWallets.length > 0 &&
      !globalLoginState.loginInProgress &&
      !globalLoginState.backendLoginInProgress
    ) {
      // Trigger backend login
      (async () => {
        globalLoginState.backendLoginInProgress = true;
        try {
          const result = await apiClient.login();

          // Fetch profile and update state
          const profileResult = await apiClient.getProfile();
          if (profileResult.success && profileResult.user) {
            setUserAtom({ user: profileResult.user, status: "authenticated" });
            queryClient.setQueryData(["profile"], profileResult.user);
            queryClient.invalidateQueries({ queryKey: ["profile"] });

            // Analytics
            posthog.identify(result.userId, { wallet: result.wallet });
            trackEvent("UserLoggedIn");
          }
        } catch (error) {
          setAuthError(
            error instanceof Error ? error.message : "Backend login failed",
          );
        } finally {
          globalLoginState.backendLoginInProgress = false;
        }
      })();
    }
  }, [
    privyUser,
    userState.status,
    queryClient,
    setUserAtom,
    posthog,
    trackEvent,
    setAuthError,
  ]);

  return {
    // Auth state
    authenticated,
    ready,
    privyUser,

    // Actions
    login,
    logout,
    linkWallet,

    // Status
    isAuthenticating: isAuthenticating || profileFetchMutation.isPending,
    authError:
      authError ||
      (profileFetchMutation.error ? profileFetchMutation.error.message : null),
    clearError: () => setAuthError(null),

    // Profile fetch state
    isFetching: profileFetchMutation.isPending,
    fetchError: profileFetchMutation.error,
  };
}
