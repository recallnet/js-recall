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

// Module-scoped guard to serialize backend login across multiple hook instances
let loginInFlight: Promise<unknown> | null = null;

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

  const { linkWallet: triggerPrivyLinkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
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
        try {
          const result = await apiClient.linkWallet({ walletAddress });
          if (result.success && result.user) {
            setUserAtom({ user: result.user, status: "authenticated" });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
        } catch (error) {
          console.error("Backend wallet linking failed:", error);
          setAuthError(
            error instanceof Error ? error.message : "Failed to link wallet",
          );
        }
      }
    },
    onError: (error) => {
      // Silently handle user cancellations and expected errors
      const errorString = String(error || "");
      if (
        error === PrivyErrorCode.USER_EXITED_LINK_FLOW ||
        error === PrivyErrorCode.CANNOT_LINK_MORE_OF_TYPE ||
        error === PrivyErrorCode.MUST_BE_AUTHENTICATED ||
        errorString.includes("must_be_authenticated")
      ) {
        // Resolve promise with null for cancellations
        if (linkWalletPromiseRef.current) {
          linkWalletPromiseRef.current.resolve(null);
          linkWalletPromiseRef.current = null;
        }
        setAuthError(null);
        return;
      }
      console.error("Wallet linking failed:", error);
      setAuthError("Failed to link wallet");

      // Reject promise for actual errors
      if (linkWalletPromiseRef.current) {
        linkWalletPromiseRef.current.reject(error);
        linkWalletPromiseRef.current = null;
      }
    },
  });

  // Awaitable wrapper around the Privy link flow
  const linkWalletAsync = useCallback(async (): Promise<string | null> => {
    setAuthError(null);
    return new Promise<string | null>((resolve, reject) => {
      linkWalletPromiseRef.current = { resolve, reject };
      triggerPrivyLinkWallet();
    });
  }, [triggerPrivyLinkWallet]);

  // Use Privy's useLogin hook with proper callback handling
  const { login: privyLogin } = useLogin({
    onComplete: async ({ user: privyUser }) => {
      try {
        // Step 1: Check if user needs to link a wallet before login
        const privyLinkedWallets = getCustomLinkedWallets(privyUser);
        let linkedWalletAddress: string | null = null;

        // If there are no custom linked wallets, prompt user to link wallet before backend login
        // TODO: this is temporary as part of the profile migration. i.e., our ideal state is email
        // first, and custom wallets are for the crypto savvy (via linking it in their profile).
        // But, we try to coerce legacy users to link the wallet during onboarding so that we can
        // search for their existing account.
        if (privyLinkedWallets.length === 0) {
          try {
            linkedWalletAddress = await linkWalletAsync();
          } catch {
            // User cancelled wallet linking, continue anyway (e.g., they cancelled the linking flow)
          }
        }

        // Step 2: Complete backend login
        if (!loginInFlight) {
          loginInFlight = (async () => {
            const result = await apiClient.login();
            // Identify user in analytics once per login
            posthog.identify(result.userId, { wallet: result.wallet });
            trackEvent("UserLoggedIn");
          })();
        }
        await loginInFlight;

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

        // Step 5: If a wallet was linked during login, persist it to backend now
        if (linkedWalletAddress) {
          try {
            const result = await apiClient.linkWallet({
              walletAddress: linkedWalletAddress,
            });
            if (result.success && result.user) {
              setUserAtom({ user: result.user, status: "authenticated" });
              queryClient.setQueryData(["profile"], result.user);
              queryClient.invalidateQueries({
                queryKey: ["profile"],
                refetchType: "none",
              });
            }
          } catch (error) {
            console.error("Backend wallet linking failed:", error);
            setAuthError(
              error instanceof Error ? error.message : "Failed to link wallet",
            );
          }
        }

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

        // Reset loginInFlight after successful login
        loginInFlight = null;

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

        // Reset loginInFlight on error
        loginInFlight = null;
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

  // Clear stale errors once authenticated to avoid repeated UI toasts across pages
  useEffect(() => {
    if (authenticated) {
      setAuthError(null);
    }
  }, [authenticated]);

  return {
    // Auth state
    authenticated,
    ready,
    privyUser,

    // Actions
    login,
    logout,
    linkWallet: triggerPrivyLinkWallet,
    linkWalletAsync,

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
