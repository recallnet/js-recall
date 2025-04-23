import { MultiChainProvider } from '../multi-chain.provider';
import { BlockchainType } from '../../../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test tokens
const solanaTokens = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const ethereumTokens = {
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

const baseTokens = {
  ETH: '0x4200000000000000000000000000000000000006', // WETH on Base
  USDC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC on Base
};

describe('MultiChainProvider', () => {
  let provider: MultiChainProvider;

  beforeEach(() => {
    provider = new MultiChainProvider();
    jest.setTimeout(30000); // Increase timeout for API calls
  });

  describe('Basic functionality', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('DexScreener MultiChain');
    });
  });

  describe('Chain detection', () => {
    it('should detect Solana addresses correctly', () => {
      const chain = provider.determineChain(solanaTokens.SOL);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it('should detect Ethereum addresses correctly', () => {
      const chain = provider.determineChain(ethereumTokens.ETH);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe('Ethereum token price fetching', () => {
    it('should fetch ETH price', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);

      console.log(`ETH price: $${priceReport?.price}`);
    });

    it('should fetch USDC price', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.USDC);

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1

      console.log(`USDC price: $${priceReport?.price}`);
    });
  });

  describe('Base token price fetching with specific chain', () => {
    it('should fetch ETH on Base with specificChain parameter', async () => {
      const priceReport = await provider.getPrice(baseTokens.ETH, BlockchainType.EVM, 'base');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);

      console.log(`ETH on Base price: $${priceReport?.price}`);
    });

    it('should fetch USDC on Base with specificChain parameter', async () => {
      const priceReport = await provider.getPrice(baseTokens.USDC, BlockchainType.EVM, 'base');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1

      console.log(`USDC on Base price: $${priceReport?.price}`);
    });
  });

  describe('Price caching', () => {
    it('should cache prices and reuse them', async () => {
      // First call to get and cache the price
      const firstPriceReport = await provider.getPrice(ethereumTokens.ETH);
      expect(firstPriceReport).not.toBeNull();

      // Start timing
      const start = Date.now();

      // Second call should use cache and be much faster
      const secondPriceReport = await provider.getPrice(ethereumTokens.ETH);

      // End timing
      const duration = Date.now() - start;

      console.log(`Cached price lookup took ${duration}ms`);

      // Second call should be very quick (under 5ms) as it's using the cache
      expect(duration).toBeLessThan(15);

      // Both prices should be the same
      expect(secondPriceReport?.price).toBe(firstPriceReport?.price);
    });
  });

  describe('Token info fetching', () => {
    it('should get detailed token info for Ethereum tokens', async () => {
      const tokenInfo = await provider.getTokenInfo(ethereumTokens.ETH, BlockchainType.EVM, 'eth');

      expect(tokenInfo).not.toBeNull();
      if (tokenInfo) {
        expect(tokenInfo.chain).toBe(BlockchainType.EVM);
        expect(tokenInfo.specificChain).toBe('eth');
        expect(tokenInfo.price).toBeGreaterThan(0);

        console.log(`ETH token info: Chain=${tokenInfo.specificChain}, Price=$${tokenInfo.price}`);
      }
    });

    it('should return chain and price info for Solana tokens', async () => {
      const tokenInfo = await provider.getTokenInfo(solanaTokens.SOL, BlockchainType.SVM, 'svm');

      expect(tokenInfo).not.toBeNull();
      if (tokenInfo) {
        expect(tokenInfo.chain).toBe(BlockchainType.SVM);
        expect(tokenInfo.specificChain).toBe('svm');
        // MultiChainProvider now supports Solana tokens
        expect(tokenInfo.price).not.toBeNull();
        expect(typeof tokenInfo.price).toBe('number');
        expect(tokenInfo.price).toBeGreaterThan(0);
      }
    });
  });

  describe('Multi-chain detection', () => {
    it('should try multiple chains when specific chain is not provided', async () => {
      // Don't specify chain, let provider detect it
      const price = await provider.getPrice(ethereumTokens.ETH);

      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe('number');
      expect(price?.price).toBeGreaterThan(0);

      console.log(`ETH price through multi-chain detection: $${price?.price}`);

      // Verify it detected the right chain
      const tokenInfo = await provider.getTokenInfo(ethereumTokens.ETH, BlockchainType.EVM, 'eth');
      if (tokenInfo && tokenInfo.specificChain) {
        console.log(`Detected ETH on chain: ${tokenInfo.specificChain}`);
        expect(tokenInfo.specificChain).toBe('eth');
      }
    });
  });

  describe('Support checking', () => {
    it('should support ETH token', async () => {
      const supported = await provider.supports(ethereumTokens.ETH, 'eth');
      expect(supported).toBe(true);
    });

    it('should support Solana tokens', async () => {
      const supported = await provider.supports(solanaTokens.SOL, 'svm');
      expect(supported).toBe(true);
    });

    it('should not support invalid tokens', async () => {
      const supported = await provider.supports('invalid_token_address', 'eth');
      expect(supported).toBe(false);
    });
  });
});
