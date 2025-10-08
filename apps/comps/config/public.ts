import z from "zod/v4";

export const configSchema = z.strictObject({
  frontendUrl: z.union([z.url(), z.literal("")]).default(""),
  rpc: z.object({
    baseSepolia: z.string().default(""),
  }),
  boost: z.object({
    noStakeBoostAmount: z.coerce.bigint().default(0n),
  }),
  publicFlags: z.object({
    enableSandbox: z.coerce.boolean().default(false),
    disableLeaderboard: z.coerce.boolean().default(false),
    tge: z.coerce.boolean().default(false),
  }),
});

export const rawConfig = {
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
  rpc: {
    baseSepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "",
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
