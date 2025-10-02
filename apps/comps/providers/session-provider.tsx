import {
  ConnectWalletModalOptions,
  LoginModalOptions,
  User,
  WalletWithMetadata,
  useLinkAccount,
  useLogin,
  usePrivy,
} from "@privy-io/react-auth";
import * as Sentry from "@sentry/nextjs";
import {
  QueryObserverResult,
  RefetchOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  MouseEvent,
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ApiClient } from "@/lib/api-client";
import { mergeWithoutUndefined } from "@/lib/merge-without-undefined";
import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { User as BackendUser, UpdateProfileRequest } from "@/types";

type Session = {
  // Login to Privy state
  ready: boolean;
  login: (options?: LoginModalOptions | MouseEvent<HTMLElement>) => void;
  user: User | null;
  isLoginPending: boolean;
  loginError: Error | null;
  logout: () => Promise<void>;
  // Allow caller to manually prompt to link wallet
  linkWallet: (
    options?: ConnectWalletModalOptions | MouseEvent<HTMLElement>,
  ) => void;
  linkWalletError: Error | null;

  // Fetch user state
  backendUser: BackendUser | undefined;
  isFetchBackendUserLoading: boolean;
  isFetchBackendUserError: boolean;
  fetchBackendUserError: Error | null;
  // Allow caller to manually refetch user data
  refetchBackendUser: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<BackendUser | undefined, Error>>;

  // Login to backend state
  isLoginToBackendPending: boolean;
  isLoginToBackendError: boolean;
  loginToBackendError: Error | null;

  // Update backendUser state
  updateBackendUser: (updates: UpdateProfileRequest) => Promise<BackendUser>;
  isUpdateBackendUserPending: boolean;
  isUpdateBackendUserError: boolean;
  updateBackendUserError: Error | null;

  // Link wallet to backend state
  isLinkWalletToBackendPending: boolean;
  isLinkWalletToBackendError: boolean;
  linkWalletToBackendError: Error | null;

  // Combined state
  isAuthenticated: boolean;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

export const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const apiClient = useRef(new ApiClient());

  const { user, ready, authenticated, logout, isModalOpen, createWallet } =
    usePrivy();

  const [loginError, setLoginError] = useState<Error | null>(null);
  const [shouldLinkWallet, setShouldLinkWallet] = useState(false);
  const [linkWalletError, setLinkWalletError] = useState<Error | null>(null);

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
      loginToBackend();
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

  const {
    mutate: loginToBackend,
    isSuccess: isLoginToBackendSuccess,
    isPending: isLoginToBackendPending,
    isError: isLoginToBackendError,
    error: loginToBackendError,
  } = useMutation({
    mutationFn: async () => {
      await apiClient.current.login();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff: 1s, 2s, 4s, max 10s
    onSuccess: () => {
      refetchBackendUser();
    },
    onError: (error) => {
      const message = `Login to backend failed: ${error}`;
      console.error(message);
      Sentry.captureException(new Error(message));
    },
  });

  // Query for BackendUser session data
  const {
    data: backendUser,
    isLoading: isFetchBackendUserLoading,
    isError: isFetchBackendUserError,
    error: fetchBackendUserError,
    refetch: refetchBackendUser,
  } = useQuery(
    tanstackClient.user.getProfile.queryOptions({
      enabled: authenticated && ready && isLoginToBackendSuccess,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
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

  const {
    mutate: linkWalletToBackend,
    isPending: isLinkWalletToBackendPending,
    isError: isLinkWalletToBackendError,
    error: linkWalletToBackendError,
  } = useMutation(
    tanstackClient.user.linkWallet.mutationOptions({
      onSuccess: () => {
        refetchBackendUser();
      },
    }),
  );

  const { linkWallet: linkWalletInner } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      const walletAddress = (
        linkedAccount as WalletWithMetadata
      ).address.toLowerCase();
      linkWalletToBackend({ walletAddress });
    },
    onError: (err) => {
      if (err === "exited_link_flow") return;
      setLinkWalletError(new Error(err));
    },
  });
  const linkWallet = useCallback(
    (options?: Parameters<typeof linkWalletInner>[0]) => {
      setLinkWalletError(null);
      linkWalletInner(options);
    },
    [linkWalletInner, setLinkWalletError],
  );

  useEffect(() => {
    if (backendUser && shouldLinkWallet) {
      linkWallet();
      setShouldLinkWallet(false);
    }
  }, [backendUser, shouldLinkWallet, linkWallet]);

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
        const previousUser = queryClient.getQueryData<BackendUser>(queryKey);

        // Optimistically update the cache
        queryClient.setQueryData<BackendUser>(queryKey, (old) => {
          if (!old) return undefined;
          return mergeWithoutUndefined(old, updates);
        });

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
        queryClient.setQueryData<BackendUser>(
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

  const session: Session = {
    // Login to Privy state
    ready,
    login,
    user,
    isLoginPending: isModalOpen,
    loginError,
    logout,
    // Allow caller to manually prompt to link wallet
    linkWallet,
    linkWalletError,

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
    isPending:
      isModalOpen ||
      isFetchBackendUserLoading ||
      isLoginToBackendPending ||
      isUpdateBackendUserPending ||
      isLinkWalletToBackendPending,
    isError:
      !!loginError ||
      !!linkWalletError ||
      isFetchBackendUserError ||
      isLoginToBackendError ||
      isUpdateBackendUserError ||
      isLinkWalletToBackendError,
    error:
      loginError ||
      linkWalletError ||
      fetchBackendUserError ||
      loginToBackendError ||
      updateBackendUserError ||
      linkWalletToBackendError,
  };

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
