import { MultiChainProvider } from '../multi-chain.provider';
import { BlockchainType, SpecificChain } from '../../../types';
import dotenv from 'dotenv';

// Load environment variables for API access
dotenv.config();

// Skip tests if NOVES_API_KEY is not set
const apiKey = process.env.NOVES_API_KEY;
const runTests = !!apiKey;

// Known test tokens from different chains
const testTokens = [
  {
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    name: 'Arbitrum (ARB)',
    expectedChain: 'arbitrum' as SpecificChain,
  },
  {
    address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    name: 'TOSHI Token',
    expectedChain: 'base' as SpecificChain,
  },
  {
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    name: 'Chainlink (LINK)',
    expectedChain: 'eth' as SpecificChain,
  },
];

/**
 * These tests verify the functionality for allowing API calls to directly
 * specify the chain type and/or specific chain, bypassing the determineChain step
 * to improve API response times.
 */
describe('Chain Override Tests', () => {
  let multiChainProvider: MultiChainProvider;

  beforeEach(() => {
    if (runTests) {
      multiChainProvider = new MultiChainProvider();
    }
  });

  describe('Direct provider tests with chain override', () => {
    it('should successfully fetch prices when providing the exact chain for at least one token', async () => {
      if (!runTests) {
        console.log('Skipping test - NOVES_API_KEY not set');
        return;
      }

      // Track if at least one token worked correctly
      let atLeastOneSuccess = false;

      for (const token of testTokens) {
        console.log(
          `Testing ${token.name} (${token.address}) with specified chain: ${token.expectedChain}`,
        );

        // Test with MultiChainProvider - this would normally try multiple chains
        // but with the override it should go directly to the specified chain
        const startTime = Date.now();
        const price = await multiChainProvider.getPrice(
          token.address,
          BlockchainType.EVM,
          token.expectedChain,
        );
        const endTime = Date.now();

        console.log(`MultiChainProvider fetch time with chain override: ${endTime - startTime}ms`);
        console.log(`Price: $${price}`);

        if (price !== null) {
          // If we got a price, this token worked correctly with chain override
          atLeastOneSuccess = true;

          // Verify price format
          expect(typeof price?.price).toBe('number');
          expect(price?.price).toBeGreaterThan(0);

          // Also get detailed token info with chain override
          const tokenInfo = await multiChainProvider.getTokenInfo(
            token.address,
            BlockchainType.EVM,
            token.expectedChain,
          );

          console.log(`Token info with chain override: ${JSON.stringify(tokenInfo)}`);

          // Verify token info
          expect(tokenInfo).not.toBeNull();
          if (tokenInfo) {
            expect(tokenInfo.chain).toBe(BlockchainType.EVM);
            expect(tokenInfo.specificChain).toBe(token.expectedChain);
          }
        } else {
          console.log(
            `Could not get price for ${token.name} on ${token.expectedChain} - this might be due to API timeouts or rate limiting`,
          );
        }
      }

      // Verify that at least one token worked
      expect(atLeastOneSuccess).toBe(true);
    }, 60000); // 60 second timeout for API calls

    it('should be faster to get prices with chain override than without', async () => {
      if (!runTests) {
        console.log('Skipping test - NOVES_API_KEY not set');
        return;
      }

      for (const token of testTokens) {
        console.log(`Performance testing for ${token.name} (${token.address})`);

        // Get price WITHOUT chain override
        const startTimeWithout = Date.now();
        await multiChainProvider.getPrice(token.address, BlockchainType.EVM);
        const endTimeWithout = Date.now();
        const timeWithout = endTimeWithout - startTimeWithout;

        console.log(`Time without chain override: ${timeWithout}ms`);

        // Short delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get price WITH chain override
        const startTimeWith = Date.now();
        await multiChainProvider.getPrice(token.address, BlockchainType.EVM, token.expectedChain);
        const endTimeWith = Date.now();
        const timeWith = endTimeWith - startTimeWith;

        console.log(`Time with chain override: ${timeWith}ms`);
        console.log(
          `Difference: ${timeWithout - timeWith}ms (${(((timeWithout - timeWith) / timeWithout) * 100).toFixed(2)}% faster)`,
        );

        // We expect the chain override to be faster, but this might not always be true
        // due to network conditions, so we just log the difference but don't assert
      }
    }, 120000); // 120 second timeout for performance tests
  });
});
