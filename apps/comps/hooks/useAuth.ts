import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { LoginRequest } from "@/types";

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

  return useMutation({
    mutationFn: async () => {
      return apiClient.logout();
    },
    onSuccess: () => {
      // Invalidate relevant queries after logout
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
