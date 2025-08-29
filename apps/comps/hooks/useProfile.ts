import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";

import { UnauthorizedError, apiClient } from "@/lib/api-client";
import { AuthStatus, useUser, userAtom } from "@/state/atoms";
import { ProfileResponse, UpdateProfileRequest } from "@/types/profile";

import { useClientCleanup } from "./useAuth";
import { useAnalytics } from "./usePostHog";
import { usePrivyAuth } from "./usePrivyAuth";

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
    refetchOnMount: false, // Don't refetch on mount if we already have data
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProfileResponse["user"]> => {
      try {
        // Always fetch fresh data from the backend when authenticated
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
  const [, setUser] = useAtom(userAtom);
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();

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

      // Invalidate profile query to get updated data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setUser({ user: data.user, status: "authenticated" as AuthStatus });
    },
  });
};

export const useLinkWallet = () => {
  const { user } = useUser();
  const [, setUser] = useAtom(userAtom);
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const { linkWallet } = usePrivyAuth();

  return useMutation({
    mutationFn: async () => {
      linkWallet();
    },
    onSuccess: () => {
      trackEvent("UserLinkedWallet", {
        updatedFields: ["walletAddress"],
      });
      setUser({ user: user, status: "authenticated" as AuthStatus });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => {
      console.error("Wallet linking failed:", error);
    },
  });
};
