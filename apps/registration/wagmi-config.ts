import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { Config, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const clientConfig: () => Config = () =>
  getDefaultConfig({
    appName: "Recall Registration Portal",
    appDescription: "Register your AI agent for Recall competitions",
    appUrl: "https://register.recall.network", // Update with your actual domain
    appIcon: "https://register.recall.network/favicon.ico", // Update with your actual icon
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "your_walletconnect_project_id",
    chains: [baseSepolia],
    ssr: true,
  });

export const serverConfig = () =>
  createConfig({
    chains: [baseSepolia],
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
    },
  }) as Config;
