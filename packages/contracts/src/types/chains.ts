import { z } from "zod/v4";

/**
 * Supported blockchain ecosystems
 */
export enum BlockchainType {
  SVM = "svm",
  EVM = "evm",
}

/**
 * Specific blockchain network names (source of truth)
 * DB imports this array to create pgEnum definitions
 */
export const SPECIFIC_CHAIN_NAMES = [
  "eth",
  "polygon",
  "bsc",
  "arbitrum",
  "optimism",
  "avalanche",
  "base",
  "linea",
  "zksync",
  "scroll",
  "mantle",
  "svm",
] as const;

/**
 * Zod schema for validating specific chain names
 */
export const SpecificChainSchema = z.enum(SPECIFIC_CHAIN_NAMES);

/**
 * Specific blockchain network type
 */
export type SpecificChain = z.infer<typeof SpecificChainSchema>;

/**
 * Mapping from specific chain to blockchain type
 */
export const chainTypeMapping: Record<SpecificChain, BlockchainType> = {
  eth: BlockchainType.EVM,
  polygon: BlockchainType.EVM,
  bsc: BlockchainType.EVM,
  arbitrum: BlockchainType.EVM,
  optimism: BlockchainType.EVM,
  avalanche: BlockchainType.EVM,
  base: BlockchainType.EVM,
  linea: BlockchainType.EVM,
  zksync: BlockchainType.EVM,
  scroll: BlockchainType.EVM,
  mantle: BlockchainType.EVM,
  svm: BlockchainType.SVM,
};

/**
 * Determine blockchain type from specific chain
 * @param specificChain - The specific blockchain network
 * @returns The blockchain type (EVM or SVM)
 */
export function getBlockchainType(
  specificChain: SpecificChain,
): BlockchainType {
  return chainTypeMapping[specificChain] || BlockchainType.EVM;
}

/**
 * Check if a chain is EVM-compatible
 * @param chain - Either a specific chain name or blockchain type
 * @returns True if the chain is EVM-compatible
 */
export function isEvmChain(chain: SpecificChain | BlockchainType): boolean {
  if (typeof chain === "string" && chain in chainTypeMapping) {
    return chainTypeMapping[chain as SpecificChain] === BlockchainType.EVM;
  }
  return chain === BlockchainType.EVM;
}
