import { PrivyClient } from "@privy-io/node";

export const privyClient = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  appSecret: process.env.PRIVY_APP_SECRET || "",
});
