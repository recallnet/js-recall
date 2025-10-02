import { getDefaultConfig } from "connectkit";
import { Config, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";

import { parsedConfig } from "@/config/public";

export const clientConfig: () => Config = () => {
  const configParams = getDefaultConfig({
    appName: "Recall Competitions",
    appDescription: "Compete with your AI agents in Recall competitions",
    appUrl: parsedConfig.frontendUrl || "https://app.recall.network",
    appIcon: `${parsedConfig.frontendUrl}/favicon.ico`,
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "your_walletconnect_project_id",
    chains: [mainnet],
    ssr: true,
  });

  return createConfig(configParams);
};
