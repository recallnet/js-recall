import { Chain, base, baseSepolia } from "viem/chains";
import z from "zod/v4";

export const configSchema = z
  .strictObject({
    frontendUrl: z.union([z.url(), z.literal("")]).default(""),
    blockchain: z.object({
      chainId: z.coerce.number().default(84532),
      chain: z.custom<Chain>().default(baseSepolia),
      rpcUrl: z.url().optional(),
      tokenContractAddress: z
        .string()
        .default("0x7323CC5c18DEcCD3e918bbccff80333961d85a88"),
      stakingContractAddress: z
        .string()
        .default("0x4F93a503972F1d35244C43fD76e0e880e75c14aC"),
      rewardAllocationContractAddress: z
        .string()
        .default("0x08EB26382777B344e21d0EbE92bB4B32a5FF63b6"),
      airdropContractAddress: z
        .string()
        .default("0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff"),
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
    airdropContractAddress: process.env.NEXT_PUBLIC_AIRDROP_CONTRACT_ADDRESS,
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
