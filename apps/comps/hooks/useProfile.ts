import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import { ProfileResponse, UpdateProfileRequest } from "@/types/profile";

const apiClient = new ApiClient();

/**
 * Hook to fetch user profile
 * @returns Query result with profile data
 */
export const useProfile = () => {
  const { status } = useUser();

  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<ProfileResponse["user"]> => {
      const res = await apiClient.getProfile();
      if (!res.success) throw new Error("Error when fetching profile");
      return res.user;
    },
    enabled: status === "authenticating" || status === "authenticated",
  });
};

/**
 * Hook to update user profile
 * @returns Mutation for updating profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      return apiClient.updateProfile(data);
    },
    onSuccess: () => {
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
