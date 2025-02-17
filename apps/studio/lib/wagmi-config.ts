import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { testnet } from "@recallnet/chains";

export const config = getDefaultConfig({
  appName: "Recall Studio",
  chains: [testnet],
  transports: {
    [testnet.id]: http(testnet.rpcUrls.default.http[0]),
  },
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  ssr: true,
});
