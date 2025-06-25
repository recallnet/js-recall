import { useMutation, useQuery } from "@tanstack/react-query";

import { internalApi } from "@/lib/internal-api";

/**
 * Hook to fetch user data from Loops by email
 * @param email Email address to search for
 * @returns Query result with Loops user data
 */
export const useLoopsUser = (email?: string) =>
  useQuery({
    queryKey: ["loops-user", email],
    queryFn: async () => {
      if (!email) throw new Error("Email is required");
      return internalApi.getLoopsUser(email);
    },
    enabled: !!email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

/**
 * Hook to update user verification status in Loops
 * @returns Mutation for updating Loops verification
 */
export const useUpdateLoopsVerification = () =>
  useMutation({
    mutationFn: async ({
      email,
      name,
      verified,
    }: {
      email: string;
      name: string;
      verified: boolean;
    }) => {
      return internalApi.updateLoopsUser({
        email,
        name,
        verified,
      });
    },
  });

/**
 * Hook to check and sync verification status between trading activity and Loops
 * @returns Mutation for syncing verification status
 */
export const useSyncLoopsVerification = () =>
  useMutation({
    mutationFn: async ({
      email,
      userName,
      hasTraded,
    }: {
      email: string;
      userName: string;
      hasTraded: boolean;
    }) => {
      // Get user data from Loops
      const loopsResponse = await internalApi.getLoopsUser(email);

      if (!loopsResponse.success || !loopsResponse.user) {
        console.log("User not found in Loops, skipping verification sync");
        return { synced: false, reason: "User not found in Loops" };
      }

      // Check if user is already verified in Loops
      if (loopsResponse.user.verified) {
        console.log("User already verified in Loops");
        return { synced: false, reason: "Already verified" };
      }

      // If user has traded, update verification in Loops
      if (hasTraded) {
        console.log("Updating Loops verification: user has traded");
        const updateResponse = await internalApi.updateLoopsUser({
          email,
          name: userName,
          verified: true,
        });

        if (updateResponse.success) {
          console.log("Successfully synced verification status to Loops");
          return { synced: true, reason: "Verification synced" };
        } else {
          throw new Error("Failed to update verification in Loops");
        }
      } else {
        console.log("User has not traded, no verification sync needed");
        return { synced: false, reason: "No trading activity" };
      }
    },
  });
