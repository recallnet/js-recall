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
import { useCallback, useRef, useState } from "react";

import { useAnalytics } from "@/hooks/usePostHog";
import { apiClient } from "@/lib/api-client";
import { userAtom } from "@/state/atoms";

// Note: the officially exported `PrivyErrorCode` type cannot be used, so we type a subset
enum PrivyErrorCode {
  USER_EXITED_AUTH_FLOW = "exited_auth_flow",
  USER_EXITED_LINK_FLOW = "exited_link_flow",
  CANNOT_LINK_MORE_OF_TYPE = "cannot_link_more_of_type",
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
 * Check if a Privy user is set up with an embedded wallet. Embedded wallets are linked
 * accounts with a wallet client type that is "privy".
 * @param wallet - The linked account to check.
 * @returns True if the linked account is an embedded wallet, false otherwise. If the user is not
 * set up with an embedded wallet, returns false.
 */
function isEmbeddedLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType === "privy";
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

/**
 * Get the custom linked wallet from a Privy user.
 * @param privyUser - The Privy user to get the custom linked wallet from.
 * @returns The custom linked wallet, or undefined if no custom linked wallet is found.
 */
function getEmbeddedLinkedWallet(
  privyUser: PrivyUser,
): WalletWithMetadata | undefined {
  const embeddedWallet = privyUser.linkedAccounts.find(isEmbeddedLinkedWallet);
  // Transform wallet address to lowercase for db comparison reasons
  if (embeddedWallet) {
    embeddedWallet.address = embeddedWallet.address.toLowerCase();
  }
  return embeddedWallet;
}

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

  const { linkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      try {
        const walletAddress = (linkedAccount as WalletWithMetadata).address;
        console.log("linkedAccount", linkedAccount);
        // Call backend to update user with new linked wallet
        const result = await apiClient.linkWallet({ walletAddress });

        if (result.success && result.user) {
          setUserAtom({ user: result.user, status: "authenticated" });

          // Only invalidate profile and user-specific data for wallet linking
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }
      } catch (error) {
        console.error("Backend wallet linking failed:", error);
        setAuthError(
          error instanceof Error ? error.message : "Failed to link wallet",
        );
      }
    },
    onError: (error) => {
      // catch `exited_link_flow` error and do nothing
      if (error === PrivyErrorCode.USER_EXITED_LINK_FLOW) {
        return;
      }
      if (error === PrivyErrorCode.CANNOT_LINK_MORE_OF_TYPE) {
        return;
      }
      console.error("Wallet linking failed:", error);
      setAuthError("Failed to link wallet");
    },
  });

  // Use Privy's useLogin hook with proper callback handling
  const { login: privyLogin } = useLogin({
    onComplete: async ({ user: privyUser }) => {
      try {
        // Now that Privy authentication is complete, call backend to sync user
        const result = await apiClient.login();

        // Fetch profile data immediately to avoid race conditions
        const profileResult = await apiClient.getProfile();
        if (!profileResult.success || !profileResult.user) {
          throw new Error("Failed to fetch user profile after login");
        }

        // If the user hasn't linked a custom wallet *and* the backend user has a different wallet address,
        // prompt the user to link their wallet.
        const privyEmbeddedWallet = getEmbeddedLinkedWallet(privyUser);
        const privyLinkedWallets = getCustomLinkedWallets(privyUser);
        if (
          profileResult.user.walletAddress !== privyEmbeddedWallet?.address &&
          privyLinkedWallets.length === 0
        ) {
          linkWallet();
        }

        // Update authentication state with actual user data (no more null user state)
        setUserAtom({ user: profileResult.user, status: "authenticated" });

        // Invalidate queries to refresh other data
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["user-competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competition"] });

        setIsAuthenticating(false);
        setAuthError(null);

        // Track successful login in PostHog
        posthog.identify(result.userId, { wallet: result.wallet });
        trackEvent("UserLoggedIn");

        return true;
      } catch (error) {
        console.error("Backend authentication failed:", error);
        setAuthError(
          error instanceof Error
            ? error.message
            : "Backend authentication failed",
        );
        setIsAuthenticating(false);

        // Reset to unauthenticated on error
        setUserAtom({ user: null, status: "unauthenticated" });
      }
    },
    onError: (error) => {
      const errorMessage = String(error) || "Authentication failed";

      // Don't show errors for user cancellations
      if (error === PrivyErrorCode.USER_EXITED_AUTH_FLOW) {
        setIsAuthenticating(false);
        setAuthError(null);
        return;
      }

      console.error("Privy login failed:", error);
      setAuthError(errorMessage);
      setIsAuthenticating(false);

      // Reset to unauthenticated on Privy login failure
      setUserAtom({ user: null, status: "unauthenticated" });
    },
  });

  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      setUserAtom({ user: null, status: "unauthenticated" });
      queryClient.clear();
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
      console.error("Profile fetch failed:", error);
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
