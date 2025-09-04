/**
 * Mock PriceTracker for testing
 *
 * This mock ensures consistent price data is always returned,
 * eliminating failures due to missing DexScreener price data.
 */
import { config } from "@/config/index.js";
import { serviceLogger } from "@/lib/logger.js";
import { PriceTracker } from "@/services/price-tracker.service.js";
import { BlockchainType, PriceReport, SpecificChain } from "@/types/index.js";

/**
 * Mock PriceTracker that always returns valid price data
 * Eliminates intermittent failures due to DexScreener API issues
 *
 * Extends the real PriceTracker and overrides the methods that fetch external data
 */
export class MockPriceTracker extends PriceTracker {
  // Simulated price data to maintain consistency
  private readonly mockPriceData: Map<string, PriceReport>;

  constructor() {
    super(); // Call parent constructor
    this.mockPriceData = new Map();

    // Pre-populate with common token prices to ensure consistency
    this.initializeDefaultPrices();
  }

  /**
   * Initialize default prices for common tokens
   * Ensures all tests have access to reasonable price data
   */
  private initializeDefaultPrices(): void {
    // ETH/WETH addresses for different chains (used for gas calculations)
    const wethAddresses = [
      config.specificChainTokens.eth.eth, // Ethereum WETH
      config.specificChainTokens.polygon.eth, // Polygon WETH
      config.specificChainTokens.arbitrum.eth, // Arbitrum WETH
      config.specificChainTokens.optimism.eth, // Optimism WETH
      config.specificChainTokens.base.eth, // Base WETH
    ];

    // Set consistent ETH price across all chains
    wethAddresses.forEach((address) => {
      this.setPriceData(address.toLowerCase(), {
        price: 3000, // Fixed ETH price
        symbol: "WETH",
        decimals: 18,
      });
    });

    // Add some common stablecoins
    const stablecoins = [
      { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC" }, // USDC Ethereum
      { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", symbol: "USDT" }, // USDT Ethereum
      { address: "0x6b175474e89094c44da98b954eedeac495271d0f", symbol: "DAI" }, // DAI Ethereum
      { address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", symbol: "USDC" }, // USDC Polygon
    ];

    stablecoins.forEach(({ address, symbol }) => {
      this.setPriceData(address.toLowerCase(), {
        price: 1, // Stable at $1
        symbol,
        decimals: symbol === "USDC" || symbol === "USDT" ? 6 : 18,
      });
    });
  }

  /**
   * Set price data for a specific token
   */
  private setPriceData(
    tokenAddress: string,
    data: { price: number; symbol: string; decimals: number },
  ): void {
    const priceReport: PriceReport = {
      price: data.price,
      symbol: data.symbol,
      token: tokenAddress,
      timestamp: new Date(),
      chain: BlockchainType.EVM, // Default to EVM
      specificChain: "eth" as SpecificChain, // Default chain
      pairCreatedAt: Date.now() - 86400000 * 7, // 7 days ago (as timestamp)
      volume: { h24: 1000000 }, // Mock volume with correct structure
      liquidity: { usd: 5000000 }, // Mock liquidity with correct structure
      fdv: data.price * 1000000000, // Mock FDV
    };

    this.mockPriceData.set(tokenAddress.toLowerCase(), priceReport);
  }

  /**
   * Generate a consistent mock price for any token
   * Uses token address to generate deterministic prices
   */
  private generateMockPrice(tokenAddress: string): number {
    // Use the last 4 chars of address to generate a consistent price
    // This ensures the same token always gets the same price
    const lastChars = tokenAddress.slice(-4).toLowerCase();
    const charSum = lastChars
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    // Generate price between $0.01 and $100
    const price = 0.01 + (charSum % 10000) / 100;
    return Number(price.toFixed(4));
  }

  /**
   * Override getPrice to return mock data
   * Always returns a valid price
   */
  override async getPrice(
    tokenAddress: string,
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<PriceReport | null> {
    const normalizedAddress = tokenAddress.toLowerCase();

    serviceLogger.debug(
      `[MockPriceTracker] Getting price for token: ${tokenAddress}`,
    );

    // Check if we have pre-set data
    let priceReport = this.mockPriceData.get(normalizedAddress);

    if (!priceReport) {
      // Generate mock data for unknown tokens
      const mockPrice = this.generateMockPrice(tokenAddress);
      const chain = blockchainType || this.determineChain(tokenAddress);

      priceReport = {
        price: mockPrice,
        symbol: `TOKEN_${tokenAddress.slice(2, 8).toUpperCase()}`, // Generate symbol from address
        token: tokenAddress,
        timestamp: new Date(),
        chain,
        specificChain: specificChain || ("eth" as SpecificChain),
        pairCreatedAt: Date.now() - 86400000 * 7, // 7 days ago (as timestamp)
        volume: { h24: mockPrice * 100000 }, // Mock volume with correct structure
        liquidity: { usd: mockPrice * 500000 }, // Mock liquidity with correct structure
        fdv: mockPrice * 1000000000, // Mock FDV
      };

      // Cache it for consistency
      this.mockPriceData.set(normalizedAddress, priceReport);
    }

    if (priceReport) {
      serviceLogger.debug(
        `[MockPriceTracker] Returning mock price for ${tokenAddress}: $${priceReport.price}`,
      );
    }

    return priceReport || null;
  }

  /**
   * Override getBulkPrices to return mock data
   * Always returns valid prices for all requested tokens
   */
  override async getBulkPrices(
    tokenAddresses: string[],
  ): Promise<Map<string, PriceReport | null>> {
    serviceLogger.debug(
      `[MockPriceTracker] Getting bulk prices for ${tokenAddresses.length} tokens`,
    );

    const resultMap = new Map<string, PriceReport | null>();

    // Generate consistent prices for all tokens
    for (const tokenAddress of tokenAddresses) {
      const priceReport = await this.getPrice(tokenAddress);
      resultMap.set(tokenAddress, priceReport);
    }

    serviceLogger.info(
      `[MockPriceTracker] Returned mock prices for ${tokenAddresses.length}/${tokenAddresses.length} tokens (100% success rate)`,
    );

    return resultMap;
  }

  /**
   * Mock getBulkTokenInfo to return mock data
   * Returns detailed token information for all requested tokens
   */
  async getBulkTokenInfo(
    tokenAddresses: string[],
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<Map<string, PriceReport | null>> {
    // Log the parameters for debugging purposes
    if (blockchainType || specificChain) {
      serviceLogger.debug(
        `[MockPriceTracker] getBulkTokenInfo called with chain: ${blockchainType}, specific: ${specificChain}`,
      );
    }
    // For mock purposes, this is the same as getBulkPrices
    return this.getBulkPrices(tokenAddresses);
  }

  /**
   * Mock getTokenInfo to return mock data
   * Returns detailed information for a single token
   */
  async getTokenInfo(
    tokenAddress: string,
    blockchainType?: BlockchainType,
    specificChain?: SpecificChain,
  ): Promise<PriceReport | null> {
    return this.getPrice(tokenAddress, blockchainType, specificChain);
  }

  /**
   * Helper method for tests to set specific token prices
   * Useful for testing specific scenarios
   */
  setTokenPrice(
    tokenAddress: string,
    price: number,
    symbol: string = "TEST",
    decimals: number = 18,
  ): void {
    this.setPriceData(tokenAddress.toLowerCase(), { price, symbol, decimals });
  }

  /**
   * Clear all price data (useful for test isolation)
   */
  clearPriceData(): void {
    this.mockPriceData.clear();
    this.initializeDefaultPrices(); // Re-initialize defaults
  }
}
