import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      return apiClient.login(data);
    },
    onSuccess: () => {
      // Invalidate relevant queries after login
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

/**
 * Hook to logout
 * @returns Mutation for logging out
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [, setUserAtom] = useAtom(userAtom);

  return useMutation({
    mutationFn: async () => {
      try {
        // Call the logout API first
        await apiClient.logout();
      } catch (error) {
        // Log API error but proceed with client-side cleanup
        console.error("Logout API call failed:", error);
      } finally {
        // Clear all queries from cache
        queryClient.clear(); // Clears all query data

        setUserAtom({ user: null, loggedIn: false });

        // Clear local storage items
        localStorage.removeItem("user");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
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

interface UserSessionState {
  user: ProfileResponse["user"] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isProfileUpdated: boolean;
}

export const useUserSession = (): UserSessionState => {
  const [optimisticUserAtom, setOptimisticUserAtom] = useAtom(userAtom);
  const queryClient = useQueryClient();

  const {
    data: profileData,
    error: profileError,
    isLoading: profileIsLoading,
    isSuccess: profileIsSuccess,
    isError: profileIsError,
    isFetching: profileIsFetching,
  } = useProfile();

  const isAuthenticated = profileIsSuccess && !!profileData;
  const isProfileUpdated = profileIsSuccess && !!profileData?.name;

  const isLoading =
    profileIsLoading ||
    (optimisticUserAtom.loggedIn && !profileIsSuccess && !profileIsError) ||
    profileIsFetching;

  useEffect(() => {
    if (profileIsSuccess && profileData) {
      if (
        !optimisticUserAtom.loggedIn ||
        optimisticUserAtom.user?.walletAddress !== profileData.walletAddress
      ) {
        setOptimisticUserAtom({
          user: profileData,
          loggedIn: true,
        });
      }
    } else if (profileIsError) {
      const isUnauthorized = (profileError as any)?.response?.status === 401;

      if (isUnauthorized) {
        if (optimisticUserAtom.loggedIn) {
          setOptimisticUserAtom({ user: null, loggedIn: false });
        }
        queryClient.removeQueries({ queryKey: ["profile"] });
      }
    }
  }, [
    profileIsSuccess,
    profileData,
    profileIsError,
    profileError,
    optimisticUserAtom.loggedIn,
    optimisticUserAtom.user?.walletAddress,
    setOptimisticUserAtom,
    queryClient,
  ]);

  return {
    user: isAuthenticated ? profileData : null,
    isAuthenticated,
    isLoading,
    isProfileUpdated,
  };
};
