/**
 * Common test tokens used across multiple tests
 */
export const testTokens = {
  solana: {
    sol: "So11111111111111111111111111111111111111112",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  ethereum: {
    eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    shib: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
  },
  base: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
  },
  polygon: {
    matic: "0x0000000000000000000000000000000000001010",
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  },
};

/**
 * Specific chain tokens configuration for provider initialization
 */
export const specificChainTokens = {
  svm: {
    sol: testTokens.solana.sol,
    usdc: testTokens.solana.usdc,
  },
  eth: {
    eth: testTokens.ethereum.eth,
    usdc: testTokens.ethereum.usdc,
    usdt: testTokens.ethereum.usdt,
  },
  base: {
    eth: testTokens.base.eth,
    usdc: testTokens.base.usdc,
  },
  polygon: {
    matic: testTokens.polygon.matic,
    usdc: testTokens.polygon.usdc,
  },
};
