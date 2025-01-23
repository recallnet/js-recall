import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { ignition } from "@recall/sdkx/chains";

export const config = getDefaultConfig({
  appName: "Recall Studio",
  chains: [ignition],
  transports: {
    [ignition.id]: http(ignition.rpcUrls.default.http[0]),
  },
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  ssr: true,
});
