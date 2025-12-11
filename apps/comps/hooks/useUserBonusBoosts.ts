import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import type { RouterOutputs } from "@/rpc/router";

/**
 * Hook to fetch active bonus boosts for the authenticated user
 * @returns Query result with bonus boosts data sorted by expiration (ascending)
 */
export const useUserBonusBoosts = (): UseQueryResult<
  RouterOutputs["boost"]["userBonusBoosts"],
  Error
> =>
  useQuery(
    tanstackClient.boost.userBonusBoosts.queryOptions({
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }),
  );
