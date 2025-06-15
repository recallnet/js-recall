import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient, UnauthorizedError } from "@/lib/api-client";
import { useUser } from "@/state/atoms";
import { ProfileResponse, UpdateProfileRequest } from "@/types/profile";

import { useClientCleanup } from "./useAuth";

const apiClient = new ApiClient();

/**
 * Hook to fetch user profile
 * @returns Query result with profile data
 */
export const useProfile = () => {
  const { status } = useUser();
  const cleanup = useClientCleanup();

  return useQuery({
    queryKey: ["profile"],
    staleTime: 1000,
    queryFn: async (): Promise<ProfileResponse["user"]> => {
      try {
        const res = await apiClient.getProfile();
        if (!res.success) throw new Error("Error when fetching profile");
        return res.user;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          cleanup();
        }
        throw error;
      }
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
