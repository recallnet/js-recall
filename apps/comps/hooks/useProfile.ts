import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useAtom} from "jotai";

import {ApiClient, UnauthorizedError} from "@/lib/api-client";
import {AuthStatus, userAtom, useUser} from "@/state/atoms";
import {ProfileResponse, UpdateProfileRequest} from "@/types/profile";

import {useClientCleanup} from "./useAuth";
import {useAnalytics} from "./usePostHog";

const apiClient = new ApiClient();

/**
 * Hook to fetch user profile
 * @returns Query result with profile data
 */
export const useProfile = () => {
  const {status, user} = useUser();
  const cleanup = useClientCleanup();

  return useQuery({
    queryKey: ["profile"],
    staleTime: 1000,
    queryFn: async (): Promise<ProfileResponse["user"]> => {
      try {
        if (status === 'authenticated' && user)
          return user

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
  const [_, setUser] = useAtom(userAtom);
  const queryClient = useQueryClient();
  const {trackEvent} = useAnalytics();

  return useMutation({
    mutationFn: async (data: UpdateProfileRequest) => {
      return apiClient.updateProfile(data);
    },
    onSuccess: (data, variables) => {
      const updatedFields = Object.keys(variables).filter(
        (key) => variables[key as keyof UpdateProfileRequest] !== undefined,
      );

      trackEvent("UserUpdatedProfile", {
        updatedFields: updatedFields,
      });

      setUser({user: data.user, status: 'authenticated' as AuthStatus})
      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({queryKey: ["profile"]});
    },
  });
};
