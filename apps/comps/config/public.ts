import { Chain, base, baseSepolia } from "viem/chains";
import z from "zod/v4";

export const configSchema = z
  .strictObject({
    frontendUrl: z.union([z.url(), z.literal("")]).default(""),
    blockchain: z.object({
      chainId: z.coerce.number().default(8453),
      chain: z.custom<Chain>().default(base),
      rpcUrl: z.url().optional(),
      tokenContractAddress: z.string(),
      stakingContractAddress: z.string(),
      rewardAllocationContractAddress: z.string(),
    }),
    boost: z.object({
      noStakeBoostAmount: z.coerce.bigint().default(0n),
    }),
    publicFlags: z.object({
      enableSandbox: z.coerce.boolean().default(false),
      disableLeaderboard: z.coerce.boolean().default(false),
      tge: z.coerce.boolean().default(false),
    }),
  })
  .transform((config, ctx) => {
    let chain: Chain;
    if (config.blockchain.chainId === base.id) {
      chain = base;
    } else if (config.blockchain.chainId === baseSepolia.id) {
      chain = baseSepolia;
    } else {
      ctx.addIssue({
        code: "custom",
        message: `Unsupported chainId: ${config.blockchain.chainId}`,
      });
      return z.NEVER;
    }
    return {
      ...config,
      blockchain: {
        ...config.blockchain,
        chain,
      },
    };
  });

export const rawConfig = {
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
  blockchain: {
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL,
    tokenContractAddress: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS,
    stakingContractAddress: process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS,
    rewardAllocationContractAddress:
      process.env.NEXT_PUBLIC_REWARD_ALLOCATION_CONTRACT_ADDRESS,
  },
  boost: {
    noStakeBoostAmount: process.env.NEXT_PUBLIC_NO_STAKE_BOOST_AMOUNT,
  },
  publicFlags: {
    enableSandbox: process.env.NEXT_PUBLIC_SANDBOX_API_URL,
    disableLeaderboard: process.env.NEXT_PUBLIC_DISABLE_LEADERBOARD_TEMP,
    tge: process.env.NEXT_PUBLIC_TGE,
  },
};

export const config = configSchema.parse(rawConfig);
