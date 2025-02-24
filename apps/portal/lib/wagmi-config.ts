import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

import { ChainName, getChain } from "@recallnet/chains";

const chain = getChain(process.env.NEXT_PUBLIC_CHAIN_NAME as ChainName);

export const config = getDefaultConfig({
  appName: "Recall Portal",
  chains: [chain],
  transports: {
    [chain.id]: http(chain.rpcUrls.default.http[0]),
  },
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  ssr: true,
});
