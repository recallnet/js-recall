import {getDefaultConfig} from '@rainbow-me/rainbowkit';
import {Config, createConfig, http} from 'wagmi';
import {baseSepolia} from "wagmi/chains";

export const clientConfig = () => getDefaultConfig({
  appName: 'js-recall/comps',
  projectId: process.env.NEXT_PUBLIC_WALLET_PROJECT_ID as string,
  chains: [baseSepolia],
  ssr: true,
});

export const serverConfig = () => (createConfig({
  chains: [baseSepolia],
  ssr: true,
  transports: {
    [baseSepolia.id]: http(),
  },
}) as Config);
