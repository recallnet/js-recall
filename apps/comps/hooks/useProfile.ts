import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { ProfileResponse } from "@/types";

const apiClient = new ApiClient();

/**
 * Hook to fetch user profile
 * @returns Query result with profile data
 */
export const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<ProfileResponse> => {
      return apiClient.getProfile();
    },
  });
};

/**
 * Hook to update user profile
 * @returns Mutation for updating profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      return apiClient.updateProfile(data);
    },
    onSuccess: () => {
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
