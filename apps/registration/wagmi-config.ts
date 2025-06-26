import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { Config, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const clientConfig: () => Config = () =>
  getDefaultConfig({
    appName: "js-recall/registration",
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
