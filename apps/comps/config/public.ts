import z from "zod/v4";

export const configSchema = z.strictObject({
  frontendUrl: z.union([z.url(), z.literal("")]).default(""),
  boost: z.object({
    noStakeBoostAmount: z.coerce.bigint().optional(),
  }),
  clientFlags: z.object({
    enableSandbox: z.coerce.boolean().default(false),
    disableLeaderboard: z.coerce.boolean().default(false),
  }),
});

export const rawConfig = {
  frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
  boost: {
    noStakeBoostAmount: process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT,
  },
  clientFlags: {
    enableSandbox: process.env.NEXT_PUBLIC_SANDBOX_API_URL,
    disableLeaderboard: process.env.NEXT_PUBLIC_DISABLE_LEADERBOARD_TEMP,
  },
};

export const config = configSchema.parse(rawConfig);
