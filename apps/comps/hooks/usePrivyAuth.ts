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
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { useAnalytics } from "@/hooks/usePostHog";
import { apiClient } from "@/lib/api-client";
import { userAtom } from "@/state/atoms";
import { User } from "@/types/profile";

/**
 * Privy error codes subset for authentication flow handling.
 * Note: The officially exported `PrivyErrorCode` type cannot be used, so we type a subset.
 */
enum PrivyErrorCode {
  /** User exited the authentication flow */
  USER_EXITED_AUTH_FLOW = "exited_auth_flow",
  /** User exited the wallet linking flow */
  USER_EXITED_LINK_FLOW = "exited_link_flow",
  /** Cannot link more accounts of this type */
  CANNOT_LINK_MORE_OF_TYPE = "cannot_link_more_of_type",
  /** User must be authenticated to perform this action */
  MUST_BE_AUTHENTICATED = "must_be_authenticated",
}

/**
 * Authentication flow states tracking the progress of various authentication operations.
 */
interface AuthFlowState {
  /** Whether the initial login process is in progress */
  isLoginInProgress: boolean;
  /** Whether the backend login API call is in progress */
  isBackendLoginInProgress: boolean;
  /** Whether the wallet linking process is in progress */
  isWalletLinkingInProgress: boolean;
  /** Whether the backend wallet linking API call is in progress */
  isWalletBackendLinkingInProgress: boolean;
}

/**
 * Actions that can be dispatched to update the authentication flow state.
 */
type AuthFlowAction =
  | { type: "START_LOGIN" }
  | { type: "START_BACKEND_LOGIN" }
  | { type: "START_WALLET_LINKING" }
  | { type: "START_WALLET_BACKEND_LINKING" }
  | { type: "COMPLETE_LOGIN" }
  | { type: "COMPLETE_BACKEND_LOGIN" }
  | { type: "COMPLETE_WALLET_LINKING" }
  | { type: "COMPLETE_WALLET_BACKEND_LINKING" }
  | { type: "RESET_AUTH_FLOW" };

/**
 * Reducer to manage authentication flow state transitions.
 *
 * @param state - Current authentication flow state
 * @param action - Action to apply to the state
 * @returns Updated authentication flow state
 */
function authFlowReducer(
  state: AuthFlowState,
  action: AuthFlowAction,
): AuthFlowState {
  switch (action.type) {
    case "START_LOGIN":
      return { ...state, isLoginInProgress: true };
    case "START_BACKEND_LOGIN":
      return { ...state, isBackendLoginInProgress: true };
    case "START_WALLET_LINKING":
      return { ...state, isWalletLinkingInProgress: true };
    case "START_WALLET_BACKEND_LINKING":
      return { ...state, isWalletBackendLinkingInProgress: true };
    case "COMPLETE_LOGIN":
      return { ...state, isLoginInProgress: false };
    case "COMPLETE_BACKEND_LOGIN":
      return { ...state, isBackendLoginInProgress: false };
    case "COMPLETE_WALLET_LINKING":
      return { ...state, isWalletLinkingInProgress: false };
    case "COMPLETE_WALLET_BACKEND_LINKING":
      return { ...state, isWalletBackendLinkingInProgress: false };
    case "RESET_AUTH_FLOW":
      return {
        isLoginInProgress: false,
        isBackendLoginInProgress: false,
        isWalletLinkingInProgress: false,
        isWalletBackendLinkingInProgress: false,
      };
    default:
      return state;
  }
}

/**
 * Initial state for the authentication flow reducer.
 */
const initialAuthFlowState: AuthFlowState = {
  isLoginInProgress: false,
  isBackendLoginInProgress: false,
  isWalletLinkingInProgress: false,
  isWalletBackendLinkingInProgress: false,
};

/**
 * Check if a Privy user is set up with a custom linked wallet. Custom linked wallets are linked
 * accounts with a wallet client type that is not "privy" (i.e., not an embedded wallet).
 *
 * @param wallet - The linked account to check
 * @returns True if the linked account is a custom linked wallet, false otherwise
 */
function isCustomLinkedWallet(
  wallet: LinkedAccountWithMetadata,
): wallet is WalletWithMetadata {
  return wallet.type === "wallet" && wallet.walletClientType !== "privy";
}

/**
 * Get the custom linked wallets from a Privy user, excluding embedded wallets.
 *
 * @param privyUser - The Privy user to get the custom linked wallets from
 * @returns Array of custom linked wallets with lowercase addresses for database comparison
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
 * Result of backend authentication operations.
 */
interface BackendAuthResult {
  /** Whether the authentication was successful */
  success: boolean;
  /** User data if authentication was successful */
  user?: User;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Return type for the usePrivyAuth hook containing authentication state and methods.
 */
interface UsePrivyAuthReturn {
  // Auth state
  /** Whether the user is authenticated with Privy */
  authenticated: boolean;
  /** Whether Privy is ready for use */
  ready: boolean;
  /** The authenticated Privy user object */
  privyUser: PrivyUser | null;

  // Actions
  /** Initiate the login flow */
  login: () => void;
  /** Log out the current user */
  logout: () => void;
  /** Link a wallet to the current user */
  linkWallet: () => void;

  // Status
  /** Whether authentication is currently in progress */
  isAuthenticating: boolean;
  /** Current authentication error message */
  authError: string | null;
  /** Clear the current authentication error */
  clearError: () => void;

  // Profile fetch state
  /** Whether a profile fetch is currently in progress */
  isFetching: boolean;
  /** Error from profile fetch operations */
  fetchError: Error | null;
}

/**
 * Custom Privy authentication hook that provides comprehensive authentication management
 * including profile synchronization with backend, wallet linking, and state management.
 *
 * This hook handles the complete authentication flow:
 * 1. Privy authentication
 * 2. Backend authentication and profile sync
 * 3. Wallet linking (required for new users)
 * 4. Analytics tracking
 * 5. Query cache management
 *
 * @returns Authentication state and methods for managing user authentication
 */
export function usePrivyAuth(): UsePrivyAuthReturn {
  const { user: privyUser, authenticated, ready } = usePrivy();
  const queryClient = useQueryClient();
  const [userState, setUserAtom] = useAtom(userAtom);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { trackEvent } = useAnalytics();
  const posthog = usePostHog();

  // Use reducer to manage auth flow state instead of global mutable state
  const [authFlow, dispatch] = useReducer(
    authFlowReducer,
    initialAuthFlowState,
  );

  // Promise control to allow awaiting the Privy link flow
  const linkWalletPromiseRef = useRef<{
    resolve: (value: string | null) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);

  /**
   * Handle backend authentication and profile fetch.
   * This includes logging in with the backend API, identifying the user in analytics,
   * fetching the user profile, and updating the application state.
   *
   * @returns Promise resolving to the authentication result
   */
  const performBackendAuth =
    useCallback(async (): Promise<BackendAuthResult> => {
      try {
        // Complete backend login
        const result = await apiClient.login();

        // Identify user in analytics
        posthog.identify(result.userId, { wallet: result.wallet });
        trackEvent("UserLoggedIn");

        // Fetch profile and update state
        const profileResult = await apiClient.getProfile();
        if (!profileResult.success || !profileResult.user) {
          throw new Error("Failed to fetch user profile after login");
        }

        // Update state - user is now authenticated
        setUserAtom({ user: profileResult.user, status: "authenticated" });
        queryClient.setQueryData(["profile"], profileResult.user);

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["user-competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competitions"] });
        queryClient.invalidateQueries({ queryKey: ["competition"] });

        return { success: true, user: profileResult.user };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Backend login failed";
        setAuthError(errorMessage);
        setUserAtom({ user: null, status: "unauthenticated" });
        return { success: false, error: errorMessage };
      }
    }, [posthog, queryClient, setUserAtom, trackEvent]);

  /**
   * Handle linking a wallet to the backend for an authenticated user.
   * This updates the user's profile with the new wallet and refreshes cached data.
   *
   * @param walletAddress - The wallet address to link to the user's account
   */
  const linkWalletToBackend = useCallback(
    async (walletAddress: string) => {
      dispatch({ type: "START_WALLET_BACKEND_LINKING" });
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
        dispatch({ type: "COMPLETE_WALLET_BACKEND_LINKING" });
      }
    },
    [queryClient, setUserAtom],
  );

  const { linkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      dispatch({ type: "COMPLETE_WALLET_LINKING" });

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
        if (!authFlow.isWalletBackendLinkingInProgress) {
          await linkWalletToBackend(walletAddress);
        }
      } else {
        // If not authenticated yet, the useEffect will handle backend login
        dispatch({ type: "COMPLETE_LOGIN" });
      }
    },
    onError: async (error) => {
      // Handle user exiting link flow during pending state
      if (
        error === PrivyErrorCode.USER_EXITED_LINK_FLOW &&
        userState.status === "pending"
      ) {
        dispatch({ type: "COMPLETE_LOGIN" });
        dispatch({ type: "START_BACKEND_LOGIN" });

        try {
          await performBackendAuth();
        } finally {
          dispatch({ type: "COMPLETE_BACKEND_LOGIN" });
          setIsAuthenticating(false);
        }

        // Resolve promise with null for cancellations
        if (linkWalletPromiseRef.current) {
          linkWalletPromiseRef.current.resolve(null);
          linkWalletPromiseRef.current = null;
        }
        return;
      }

      // Handle other wallet linking errors
      if (
        error === PrivyErrorCode.CANNOT_LINK_MORE_OF_TYPE ||
        error === PrivyErrorCode.MUST_BE_AUTHENTICATED
      ) {
        setIsAuthenticating(false);
        dispatch({ type: "RESET_AUTH_FLOW" });
        setAuthError(null);

        if (linkWalletPromiseRef.current) {
          linkWalletPromiseRef.current.resolve(null);
          linkWalletPromiseRef.current = null;
        }
        return;
      }

      // Handle actual errors
      setIsAuthenticating(false);
      dispatch({ type: "RESET_AUTH_FLOW" });
      setAuthError("Failed to link wallet");

      if (linkWalletPromiseRef.current) {
        linkWalletPromiseRef.current.reject(error);
        linkWalletPromiseRef.current = null;
      }
    },
  });

  // Use Privy's useLogin hook with proper callback handling
  const { login: privyLogin } = useLogin({
    onComplete: async ({ user: privyUser }) => {
      // Mark that we're potentially waiting for wallet linking
      setUserAtom({ user: null, status: "pending" });

      // Prevent multiple onComplete executions during the same login flow
      if (authFlow.isLoginInProgress) {
        return;
      }
      dispatch({ type: "START_LOGIN" });

      try {
        // Check if user needs to link a wallet before login
        const privyLinkedWallets = getCustomLinkedWallets(privyUser);

        // If there are no custom linked wallets, prompt user to link wallet
        // TODO: this is temporary as part of the profile migration
        if (privyLinkedWallets.length === 0) {
          if (!authFlow.isWalletLinkingInProgress) {
            dispatch({ type: "START_WALLET_LINKING" });

            // Schedule the wallet linking after the current execution context
            setTimeout(() => {
              linkWallet();
            }, 100);
          }

          // Exit early - the useEffect will handle backend login once wallet is linked
          dispatch({ type: "COMPLETE_LOGIN" });
          return;
        }

        // Complete backend login
        await performBackendAuth();

        setIsAuthenticating(false);
        setAuthError(null);

        // Small delay to ensure React processes state updates
        await new Promise((resolve) => setTimeout(resolve, 100));

        dispatch({ type: "COMPLETE_LOGIN" });
        return true;
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Authentication failed",
        );
        setIsAuthenticating(false);
        setUserAtom({ user: null, status: "unauthenticated" });
        dispatch({ type: "COMPLETE_LOGIN" });
      }
    },
    onError: (error) => {
      const errorMessage = String(error) || "Authentication failed";

      // Don't show errors for user cancellations
      if (error === PrivyErrorCode.USER_EXITED_AUTH_FLOW) {
        setIsAuthenticating(false);
        setAuthError(null);
        dispatch({ type: "RESET_AUTH_FLOW" });
        return;
      }

      setAuthError(errorMessage);
      setIsAuthenticating(false);
      setUserAtom({ user: null, status: "unauthenticated" });
      dispatch({ type: "RESET_AUTH_FLOW" });
    },
  });

  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      setUserAtom({ user: null, status: "unauthenticated" });
      queryClient.clear();
      dispatch({ type: "RESET_AUTH_FLOW" });
    },
  });

  // Legacy profile fetch mutation - kept for backward compatibility
  const profileFetchMutation = useMutation({
    mutationFn: async () => {
      return apiClient.getProfile();
    },
    onSuccess: (data) => {
      if (data.success && data.user) {
        setUserAtom({ user: data.user, status: "authenticated" });
      } else {
        setUserAtom({ user: userState.user, status: "authenticated" });
      }

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

  /**
   * Initiate the login flow. This will trigger Privy authentication
   * and subsequently handle backend authentication and profile sync.
   *
   * @throws Error if Privy is not ready
   */
  const login = useCallback(() => {
    if (!ready) {
      throw new Error("Privy not ready");
    }

    setIsAuthenticating(true);
    setAuthError(null);
    privyLogin();
  }, [privyLogin, ready]);

  /**
   * Log out the current user from both Privy and the backend.
   * This clears all user state and cached data.
   */
  const logout = useCallback(() => {
    privyLogout();
  }, [privyLogout]);

  // Clear stale errors once authenticated
  useEffect(() => {
    if (authenticated) {
      setAuthError(null);
    }
  }, [authenticated]);

  // Watch for changes in linked accounts and complete login if needed
  useEffect(() => {
    if (userState.status !== "pending" || !privyUser) {
      return;
    }

    const customWallets = getCustomLinkedWallets(privyUser);
    if (
      customWallets.length > 0 &&
      !authFlow.isLoginInProgress &&
      !authFlow.isBackendLoginInProgress
    ) {
      dispatch({ type: "START_BACKEND_LOGIN" });

      performBackendAuth().finally(() => {
        dispatch({ type: "COMPLETE_BACKEND_LOGIN" });
      });
    }
  }, [
    privyUser,
    userState.status,
    authFlow.isLoginInProgress,
    authFlow.isBackendLoginInProgress,
    performBackendAuth,
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
