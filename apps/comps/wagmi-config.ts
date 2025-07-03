import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  okxWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { Config, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";

export const clientConfig: () => Config = () =>
  getDefaultConfig({
    appName: "js-recall/comps",
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      "your_walletconnect_project_id",
    chains: [baseSepolia],
    ssr: true,
    wallets: [
      {
        groupName: "Popular",
        wallets: [
          okxWallet,
          coinbaseWallet,
          (options) => {
            return walletConnectWallet({
              ...options,
              options: {
                ...options.options,
                logger: "disabled",
              },
            });
          },
        ],
      },
    ],
  });

export const serverConfig = () =>
  createConfig({
    chains: [baseSepolia],
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
    },
  }) as Config;
