import dotenv from "dotenv";
import { beforeEach, describe, expect, it } from "vitest";

import { MultiChainProvider } from "@/services/providers/multi-chain.provider.js";
import { BlockchainType, SpecificChain } from "@/types/index.js";

// Load environment variables for API access
dotenv.config();

// Skip tests if NOVES_API_KEY is not set
const apiKey = process.env.NOVES_API_KEY;
const runTests = !!apiKey;

// Known test tokens from different chains
const testTokens = [
  {
    address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
    name: "Arbitrum (ARB)",
    expectedChain: "arbitrum" as SpecificChain,
  },
  {
    address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    name: "TOSHI Token",
    expectedChain: "base" as SpecificChain,
  },
  {
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    name: "Chainlink (LINK)",
    expectedChain: "eth" as SpecificChain,
  },
];

/**
 * These tests verify the functionality for allowing API calls to directly
 * specify the chain type and/or specific chain, bypassing the determineChain step
 * to improve API response times.
 */
describe("Chain Override Tests", () => {
  let multiChainProvider: MultiChainProvider;

  beforeEach(() => {
    if (runTests) {
      multiChainProvider = new MultiChainProvider();
    }
  });

  describe("Direct provider tests with chain override", () => {
    it("should successfully fetch prices when providing the exact chain for at least one token", async () => {
      if (!runTests) {
        return;
      }

      // Track if at least one token worked correctly
      let atLeastOneSuccess = false;

      for (const token of testTokens) {
        // Test with MultiChainProvider - this would normally try multiple chains
        // but with the override it should go directly to the specified chain
        const price = await multiChainProvider.getPrice(
          token.address,
          BlockchainType.EVM,
          token.expectedChain,
        );

        if (price !== null) {
          // If we got a price, this token worked correctly with chain override
          atLeastOneSuccess = true;

          // Verify price format
          expect(typeof price?.price).toBe("number");
          expect(price?.price).toBeGreaterThan(0);

          // Also get detailed token info with chain override
          const tokenInfo = await multiChainProvider.getTokenInfo(
            token.address,
            BlockchainType.EVM,
            token.expectedChain,
          );

          // Verify token info
          expect(tokenInfo).not.toBeNull();
          if (tokenInfo) {
            expect(tokenInfo.chain).toBe(BlockchainType.EVM);
            expect(tokenInfo.specificChain).toBe(token.expectedChain);
          }
        }
      }

      // Verify that at least one token worked
      expect(atLeastOneSuccess).toBe(true);
    }, 60000); // 60 second timeout for API calls
  });
});
