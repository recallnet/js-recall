import { addRpcUrlOverrideToChain } from "@privy-io/chains";

import { config } from "@/config/public";

/**
 * Blockchain chain configuration with optional RPC URL override
 */
export const chainWithRpcUrl = config.blockchain.rpcUrl
  ? addRpcUrlOverrideToChain(config.blockchain.chain, config.blockchain.rpcUrl)
  : config.blockchain.chain;
