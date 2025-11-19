import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

/**
 * Get reward claim data with merkle proofs for the authenticated user
 *
 * Returns an array of claimable rewards with their merkle roots and proofs
 * required for claiming rewards from the RewardAllocation smart contract
 * Includes agent and competition metadata for each reward
 */
export const getClaimData = base
  .use(authMiddleware)
  .handler(async ({ context, errors }) => {
    if (!context.user.walletAddress) {
      throw errors.BAD_REQUEST({
        message: "User does not have a wallet address",
      });
    }

    try {
      const rewards = await context.rewardsService.getRewardsWithProofs(
        context.user.walletAddress,
      );

      return rewards;
    } catch (error) {
      context.logger.error(
        {
          error,
          userId: context.user.id,
          walletAddress: context.user.walletAddress,
        },
        "Failed to get rewards with proofs",
      );
      throw errors.INTERNAL({
        message: "Failed to retrieve claim data",
      });
    }
  });
