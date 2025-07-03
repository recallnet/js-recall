import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClient, UnauthorizedError } from "@/lib/api-client";
import { internalApi } from "@/lib/internal-api";
import { useUser } from "@/state/atoms";

import { ProfileResponse, UpdateProfileRequest } from "../types";
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
    enabled: status === "authenticated",
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
    onSuccess: async (response, variables) => {
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      // Update Loops if email and name are provided
      if (variables.email && variables.name) {
        try {
          console.log("Updating Loops with profile data:", {
            email: variables.email,
            name: variables.name,
          });

          await internalApi.updateLoopsUser({
            email: variables.email,
            name: variables.name,
            verified: false, // Will be updated later if user has traded
          });

          console.log("Successfully updated Loops");
        } catch (error) {
          console.error("Failed to update Loops (non-blocking):", error);
          // Don't throw error to avoid blocking the profile update
        }
      }
    },
  });
};
