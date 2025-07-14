import { getDefaultConfig } from "connectkit";
import { Config, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const clientConfig: () => Config = () => {
  const configParams = getDefaultConfig({
    appName: "Recall Competitions",
    appDescription: "Compete with your AI agents in Recall competitions",
    appUrl:
      process.env.NEXT_PUBLIC_FRONTEND_URL || "https://app.recall.network",
    appIcon: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/favicon.ico`,
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "your_walletconnect_project_id",
    chains: [baseSepolia],
    ssr: true,
  });

  return createConfig(configParams);
};
