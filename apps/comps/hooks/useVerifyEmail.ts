import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";

const apiClient = new ApiClient();

/**
 * Hook to verify email
 * @returns Mutation for verying email
 */
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async () => {
      return await apiClient.verifyEmail();
    },
    onSuccess: () => {},
  });
};
