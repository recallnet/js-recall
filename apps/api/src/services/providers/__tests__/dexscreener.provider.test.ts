import { DexScreenerProvider } from '../dexscreener.provider';
import dotenv from 'dotenv';
import { BlockchainType } from '../../../types';

// Load environment variables
dotenv.config();

// Test tokens
const solanaTokens = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
};

const ethereumTokens = {
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
  SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
};

const baseTokens = {
  ETH: '0x4200000000000000000000000000000000000006', // WETH on Base
  USDC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC on Base
};

describe('DexScreenerProvider', () => {
  let provider: DexScreenerProvider;

  beforeEach(() => {
    provider = new DexScreenerProvider();
    jest.setTimeout(30000); // Increase timeout for API calls
  });

  describe('Basic functionality', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('DexScreener');
    });
  });

  describe('Solana token price fetching', () => {
    it('should fetch SOL price', async () => {
      const priceReport = await provider.getPrice(solanaTokens.SOL, BlockchainType.SVM, 'svm');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);

      console.log(`Solana price: $${priceReport?.price}`);
    }, 15000);

    it('should fetch USDC price', async () => {
      const priceReport = await provider.getPrice(solanaTokens.USDC, BlockchainType.SVM, 'svm');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1

      console.log(`Solana USDC price: $${priceReport?.price}`);
    }, 15000);
  });

  describe('Ethereum token price fetching', () => {
    it('should fetch ETH price', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH, BlockchainType.EVM, 'eth');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);

      console.log(`ETH price: $${priceReport?.price}`);
    });

    it('should fetch USDC price', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.USDC, BlockchainType.EVM, 'eth');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1

      console.log(`USDC price: $${priceReport?.price}`);
    });

    it('should fetch ETH price above $1000 on Ethereum mainnet', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.ETH, BlockchainType.EVM, 'eth');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(1000); // ETH should be above $1000

      console.log(`ETH price on Ethereum mainnet: $${priceReport?.price}`);
    }, 15000);

    it('should fetch USDT price close to $1 on Ethereum mainnet', async () => {
      const priceReport = await provider.getPrice(ethereumTokens.USDT, BlockchainType.EVM, 'eth');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDT should be close to $1

      console.log(`USDT price on Ethereum mainnet: $${priceReport?.price}`);
    }, 15000);
  });

  describe('Base token price fetching', () => {
    it('should fetch ETH on Base', async () => {
      const priceReport = await provider.getPrice(baseTokens.ETH, BlockchainType.EVM, 'base');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);

      console.log(`ETH on Base price: $${priceReport?.price}`);
    });

    it('should fetch USDC on Base', async () => {
      const priceReport = await provider.getPrice(baseTokens.USDC, BlockchainType.EVM, 'base');

      expect(priceReport).not.toBeNull();
      expect(typeof priceReport?.price).toBe('number');
      expect(priceReport?.price).toBeGreaterThan(0);
      expect(priceReport?.price).toBeCloseTo(1, 1); // USDC should be close to $1

      console.log(`USDC on Base price: $${priceReport?.price}`);
    });
  });

  describe('Chain detection', () => {
    it('should detect Solana addresses correctly', async () => {
      const chain = provider.determineChain(solanaTokens.SOL);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it('should detect Ethereum addresses correctly', async () => {
      const chain = provider.determineChain(ethereumTokens.ETH);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe('Support checking', () => {
    it('should support SOL token', async () => {
      const supported = await provider.supports(solanaTokens.SOL, 'svm');
      expect(supported).toBe(true);
    }, 15000);

    it('should support ETH token', async () => {
      const supported = await provider.supports(ethereumTokens.ETH, 'eth');
      expect(supported).toBe(true);
    });

    it('should not support invalid tokens', async () => {
      const supported = await provider.supports('invalid_token_address', 'eth');
      expect(supported).toBe(false);
    });
  });
});
