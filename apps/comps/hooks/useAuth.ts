import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";

import {ApiClient} from "@/lib/api-client";
import {LoginRequest} from "@/types";

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
      queryClient.invalidateQueries({queryKey: ["profile"]});
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

  return useMutation({
    mutationFn: async () => {
      try {
        // Clear all queries from cache
        queryClient.clear();

        // Clear local storage items
        localStorage.clear();
        sessionStorage.clear();

        // Call the logout API
        await apiClient.logout();

        return true;
      } catch (error) {
        console.error("Logout error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries after logout
      queryClient.invalidateQueries({queryKey: ["profile"]});

      // Redirect to home page
      router.push("/");
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      // Even if the API call fails, we should still clear local state
      queryClient.clear();
      localStorage.clear();
      sessionStorage.clear();
      router.push("/");
    },
  });
};
