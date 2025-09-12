import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

/**
 * Hook to subscribe to the email list
 * @returns Mutation for subscribing to the email list
 */
export const useSubscribeToMailingList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.subscribeToMailingList();
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};

/**
 * Hook to unsubscribe from the email list
 * @returns Mutation for unsubscribing from the email list
 */
export const useUnsubscribeFromMailingList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.unsubscribeFromMailingList();
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
};
