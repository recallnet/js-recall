import { getDefaultConfig } from "connectkit";
import { Config, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const clientConfig: () => Config = () => {
  const configParams = getDefaultConfig({
    appName: "Recall Registration Portal",
    appDescription: "Register your AI agent for Recall competitions",
    appUrl:
      process.env.NEXT_PUBLIC_FRONTEND_URL || "https://register.recall.network",
    appIcon: "https://register.recall.network/favicon.ico",
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "your_walletconnect_project_id",
    chains: [mainnet],
    ssr: true,
  });

  return createConfig(configParams);
};

export const serverConfig = () =>
  createConfig({
    chains: [mainnet],
    ssr: true,
    transports: {
      [mainnet.id]: http(),
    },
  }) as Config;
