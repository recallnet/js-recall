import type { Chain } from "viem";
import { base, baseSepolia, hardhat } from "viem/chains";

/**
 * Supported networks for the staking contracts
 */
export enum Network {
  BaseSepolia = "baseSepolia",
  Base = "base",
  Hardhat = "hardhat",
}

/**
 * Maps a Network enum value to its corresponding Viem Chain
 * @param network The network to get the chain for
 * @returns The Viem Chain object
 */
export function getChainForNetwork(network: Network): Chain {
  switch (network) {
    case Network.Base:
      return base;
    case Network.Hardhat:
      return hardhat;
    case Network.BaseSepolia:
    default:
      return baseSepolia;
  }
}
