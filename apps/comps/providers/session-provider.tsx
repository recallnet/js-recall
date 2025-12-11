import {
  ConnectWalletModalOptions,
  LoginModalOptions,
  User,
  WalletWithMetadata,
  useConnectWallet,
  useLinkAccount,
  useLogin,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import * as Sentry from "@sentry/nextjs";
import {
  QueryObserverResult,
  RefetchOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MouseEvent,
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";

import { WrongNetworkModal } from "@/components/modals/wrong-network";
import { WrongWalletModal } from "@/components/modals/wrong-wallet";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import {
  checkOnboardingComplete,
  useOnboardingComplete,
} from "@/hooks/useOnboardingComplete";
import { mergeWithoutUndefined } from "@/lib/merge-without-undefined";
import { userWalletState } from "@/lib/user-wallet-state";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";
import { UpdateProfileRequest } from "@/types";

export type Session = {
  // Login to Privy state
  ready: boolean;
  login: (options?: LoginModalOptions | MouseEvent<HTMLElement>) => void;
  user: User | null;
  isLoginPending: boolean;
  loginError: Error | null;
  logout: () => Promise<void>;
  // Allow caller to manually prompt to link wallet
  linkOrConnectWallet: (
    options?: ConnectWalletModalOptions | MouseEvent<HTMLElement>,
  ) => void;
  linkOrConnectWalletError: Error | null;

  // Fetch user state
  backendUser: RouterOutputs["user"]["getProfile"] | undefined;
  isFetchBackendUserLoading: boolean;
  isFetchBackendUserError: boolean;
  fetchBackendUserError: Error | null;
  // Allow caller to manually refetch user data
  refetchBackendUser: (
    options?: RefetchOptions,
  ) => Promise<
    QueryObserverResult<RouterOutputs["user"]["getProfile"] | undefined, Error>
  >;

  // Login to backend state
  isLoginToBackendPending: boolean;
  isLoginToBackendError: boolean;
  loginToBackendError: Error | null;

  // Update backendUser state
  updateBackendUser: (
    updates: UpdateProfileRequest,
  ) => Promise<RouterOutputs["user"]["updateProfile"]>;
  isUpdateBackendUserPending: boolean;
  isUpdateBackendUserError: boolean;
  updateBackendUserError: Error | null;

  // Link wallet to backend state
  isLinkWalletToBackendPending: boolean;
  isLinkWalletToBackendError: boolean;
  linkWalletToBackendError: Error | null;

  // Combined state
  isAuthenticated: boolean;
  isWalletConnected: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

export const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { user, ready, authenticated, logout, isModalOpen, createWallet } =
    usePrivy();

  const { disconnect } = useDisconnect();
  const { isConnected, chainId: currentChainId } = useAccount();
  const { wallets, ready: readyWallets } = useWallets();
  const defaultChainId = useChainId();
  const isWrongChain = currentChainId !== defaultChainId;
  const { setActiveWallet } = useSetActiveWallet();

  const [loginError, setLoginError] = useState<Error | null>(null);
  const [shouldLinkWallet, setShouldLinkWallet] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [linkOrConnectWalletError, setLinkOrConnectWalletError] =
    useState<Error | null>(null);
  const [isWrongWalletModalOpen, setIsWrongWalletModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { markComplete: markOnboardingComplete } = useOnboardingComplete();

  const handleCloseWrongWalletModal = useCallback(
    (open: boolean) => {
      disconnect(undefined, {
        onSuccess: () => setIsWrongWalletModalOpen(open),
      });
    },
    [setIsWrongWalletModalOpen, disconnect],
  );

  const {
    mutate: loginToBackend,
    isSuccess: isLoginToBackendSuccess,
    isPending: isLoginToBackendPending,
    isError: isLoginToBackendError,
    error: loginToBackendError,
  } = useMutation(
    tanstackClient.user.login.mutationOptions({
      onSuccess: () => {
        refetchBackendUser();
      },
      onError: (error) => {
        console.error("Login to backend failed:", {
          error: error?.message || String(error),
          privyAuthenticated: authenticated,
          privyReady: ready,
          privyWalletsReady: readyWallets,
          browserOnline: navigator.onLine,
        });

        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          {
            extra: {
              privyAuthenticated: authenticated,
              privyReady: ready,
              privyWalletsReady: readyWallets,
              browserOnline: navigator.onLine,
            },
          },
        );
      },
    }),
  );

  const { login: loginInner } = useLogin({
    onComplete: async ({ user, isNewUser }) => {
      // Note: Privy has a known issue where embedded wallets are, sometimes, not created for a
      // user. If an embedded wallet exists, it'll always be available in the `user.wallet`
      // property. Thus, we can simply check if it exists, else, trigger its creation explicitly.
      if (!user.wallet) {
        const message = `Privy failed to create embedded wallet. Creating wallet for user DID: ${user.id}`;
        console.warn(message);
        Sentry.captureMessage(message, "warning");
        await createWallet();
      }

      setShouldLinkWallet(isNewUser);

      // Show onboarding for new users who haven't completed it
      // Use synchronous check to avoid stale closure value
      if (!checkOnboardingComplete()) {
        setShowOnboarding(true);
      }

      loginToBackend(undefined);
    },
    onError: (err) => {
      if (err === "exited_auth_flow") return;
      setLoginError(new Error(err));
    },
  });
  const login = useCallback(
    (options?: Parameters<typeof loginInner>[0]) => {
      setLoginError(null);
      loginInner(options);
    },
    [loginInner, setLoginError],
  );
  // Query for BackendUser session data
  const {
    data: backendUser,
    isLoading: isFetchBackendUserLoading,
    isError: isFetchBackendUserError,
    error: fetchBackendUserError,
    refetch: refetchBackendUser,
  } = useQuery(
    tanstackClient.user.getProfile.queryOptions({
      input: authenticated && ready && isLoginToBackendSuccess ? {} : skipToken,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors (UNAUTHORIZED)
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "UNAUTHORIZED"
        ) {
          return false;
        }
        return failureCount < 3;
      },
    }),
  );

  // Iterate through all the connected wallets and filter out the embedded Privy wallet.
  const connectedExternalWallets = useMemo(() => {
    return wallets.filter((w) => w.walletClientType !== "privy");
  }, [wallets]);

  const {
    mutate: linkWalletToBackend,
    isPending: isLinkWalletToBackendPending,
    isError: isLinkWalletToBackendError,
    error: linkWalletToBackendError,
  } = useMutation(
    tanstackClient.user.linkWallet.mutationOptions({
      onSuccess: () => {
        refetchBackendUser();

        // Invalidate boost-related queries (mergeBoost happens during wallet link)
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.balance.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.userBoosts.key(),
        });
        queryClient.invalidateQueries({
          queryKey: tanstackClient.boost.availableAwards.key(),
        });

        // Invalidate user agents (agent ownership is transferred during merge)
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getUserAgents.key(),
        });
      },
    }),
  );

  const { linkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      const walletAddress = (
        linkedAccount as WalletWithMetadata
      ).address.toLowerCase();
      linkWalletToBackend({ walletAddress });
    },
    onError: (err) => {
      if (err === "exited_link_flow") return;
      setLinkOrConnectWalletError(new Error(err));
    },
  });

  const { connectWallet } = useConnectWallet({
    onError: (err) => {
      if (err === "generic_connect_wallet_error") return;
      setLinkOrConnectWalletError(new Error(err));
    },
  });

  const linkOrConnectWallet = useCallback(
    (options?: ConnectWalletModalOptions | MouseEvent<HTMLElement>) => {
      setLinkOrConnectWalletError(null);

      if (!backendUser) return;

      const walletState = userWalletState(backendUser);
      switch (walletState.type) {
        case "only-embedded":
          linkWallet(options);
          return;
        case "external-not-linked":
          linkWallet(options);
          return;
        case "external-linked":
          connectWallet(options);
          return;
        case "unknown": {
          const message = `Unknown wallet state for user ID: ${backendUser.id}`;
          setLinkOrConnectWalletError(new Error(message));
          console.error(message);
          return;
        }
      }
    },
    [linkWallet, setLinkOrConnectWalletError, connectWallet, backendUser],
  );

  /**
   * Synchronize wagmi's active wallet with the backend user's wallet address
   */
  const syncActiveWallet = useCallback(async () => {
    try {
      if (!readyWallets) return;

      const walletState = backendUser
        ? userWalletState(backendUser)
        : undefined;
      const userExternalWalletAddress =
        walletState?.type === "external-linked" ||
        walletState?.type === "external-not-linked"
          ? walletState.address
          : undefined;

      const match = connectedExternalWallets.find(
        (w) =>
          w.address.toLowerCase() === userExternalWalletAddress?.toLowerCase(),
      );
      if (match) {
        await setActiveWallet(match);
        setIsWalletConnected(true);
      } else if (
        userExternalWalletAddress &&
        connectedExternalWallets.length > 0
      ) {
        setIsWrongWalletModalOpen(true);
        setIsWalletConnected(false);
      } else {
        setIsWalletConnected(false);
      }
    } catch (error) {
      console.error("Failed to sync active wallet:", error);
    }
  }, [
    backendUser,
    connectedExternalWallets,
    readyWallets,
    setActiveWallet,
    setIsWrongWalletModalOpen,
    setIsWalletConnected,
  ]);

  // Sync active wallet when backend user data is available
  useEffect(() => {
    if (backendUser?.walletAddress && readyWallets) {
      // Small delay to ensure the wallet state is stable
      const timeoutId = setTimeout(() => {
        syncActiveWallet();
      }, 200);

      return () => clearTimeout(timeoutId);
      // syncActiveWallet();
    }
  }, [backendUser?.walletAddress, syncActiveWallet, readyWallets]);

  useEffect(() => {
    if (backendUser && shouldLinkWallet) {
      linkOrConnectWallet();
      setShouldLinkWallet(false);
    }
  }, [backendUser, shouldLinkWallet, linkOrConnectWallet]);

  // Mutation for updating user data
  const {
    mutateAsync: updateBackendUser,
    isPending: isUpdateBackendUserPending,
    isError: isUpdateBackendUserError,
    error: updateBackendUserError,
  } = useMutation(
    tanstackClient.user.updateProfile.mutationOptions({
      onMutate: async (updates) => {
        // Cancel outgoing refetches so they don't overwrite our optimistic update
        const queryKey = tanstackClient.user.getProfile.key();
        await queryClient.cancelQueries({ queryKey: queryKey });

        // Snapshot the previous value
        const previousUser =
          queryClient.getQueryData<RouterOutputs["user"]["getProfile"]>(
            queryKey,
          );

        // Optimistically update the cache
        queryClient.setQueryData<RouterOutputs["user"]["getProfile"]>(
          queryKey,
          (old) => {
            if (!old) return undefined;
            return mergeWithoutUndefined(old, updates);
          },
        );

        // Return a context object with the snapshotted value
        return { previousUser: previousUser };
      },
      onError: (_, __, context) => {
        // Rollback to the previous value on error
        if (context?.previousUser) {
          queryClient.setQueryData(
            tanstackClient.user.getProfile.key(),
            context.previousUser,
          );
        }
      },
      onSuccess: (updatedUser) => {
        // Update cache with the actual server response
        queryClient.setQueryData<RouterOutputs["user"]["getProfile"]>(
          tanstackClient.user.getProfile.key(),
          updatedUser,
        );
      },
      onSettled: () => {
        // Always refetch after error or success to ensure consistency
        queryClient.invalidateQueries({
          queryKey: tanstackClient.user.getProfile.key(),
        });
      },
    }),
  );

  const handleLogout = useCallback(async () => {
    try {
      // Clear all cached queries first
      queryClient.clear();

      // Disconnect from wagmi first to clear connection state
      if (isConnected) {
        disconnect();
      }
      // Then logout from Privy
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      // Still try to logout from Privy even if wagmi disconnect fails
      await logout();
    }
  }, [disconnect, logout, queryClient, isConnected]);

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleCompleteOnboarding = useCallback(() => {
    markOnboardingComplete();
  }, [markOnboardingComplete]);

  const session: Session = {
    // Login to Privy state
    ready: ready && readyWallets,
    login,
    user,
    isLoginPending: isModalOpen,
    loginError,
    logout: handleLogout,
    // Allow caller to manually prompt to link wallet
    linkOrConnectWallet,
    linkOrConnectWalletError,

    // Fetch user state
    backendUser,
    isFetchBackendUserLoading,
    isFetchBackendUserError,
    fetchBackendUserError,
    // Allow caller to manually refetch user data
    refetchBackendUser,

    // Login to backend state
    isLoginToBackendPending,
    isLoginToBackendError,
    loginToBackendError,

    // Update user state
    updateBackendUser,
    isUpdateBackendUserPending,
    isUpdateBackendUserError,
    updateBackendUserError,

    // Link wallet to backend state
    isLinkWalletToBackendPending,
    isLinkWalletToBackendError,
    linkWalletToBackendError,

    // Combined state
    isAuthenticated: authenticated && backendUser?.status === "active",
    isWalletConnected,
    isPending:
      isModalOpen ||
      isFetchBackendUserLoading ||
      isLoginToBackendPending ||
      isUpdateBackendUserPending ||
      isLinkWalletToBackendPending,
    isError:
      !!loginError ||
      !!linkOrConnectWalletError ||
      isFetchBackendUserError ||
      isLoginToBackendError ||
      isUpdateBackendUserError ||
      isLinkWalletToBackendError,
    error:
      loginError ||
      linkOrConnectWalletError ||
      fetchBackendUserError ||
      loginToBackendError ||
      updateBackendUserError ||
      linkWalletToBackendError,
  };

  return (
    <SessionContext.Provider value={session}>
      {children}
      {isWrongWalletModalOpen && session.isAuthenticated && (
        <WrongWalletModal
          isOpen
          onClose={handleCloseWrongWalletModal}
          expectedWalletAddress={backendUser?.walletAddress || ""}
        />
      )}
      {session.isAuthenticated &&
        isWalletConnected &&
        !isWrongWalletModalOpen &&
        isWrongChain &&
        defaultChainId &&
        currentChainId && (
          <WrongNetworkModal
            isOpen
            currentChainId={currentChainId}
            expectedChainId={defaultChainId}
          />
        )}
      {showOnboarding && (
        <OnboardingCarousel
          isOpen={showOnboarding}
          onClose={handleCloseOnboarding}
          onComplete={handleCompleteOnboarding}
        />
      )}
    </SessionContext.Provider>
  );
}
