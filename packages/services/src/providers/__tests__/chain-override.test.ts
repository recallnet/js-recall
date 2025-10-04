import dotenv from "dotenv";
import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { specificChainTokens } from "../../lib/config-utils.js";
import {
  BlockchainType,
  SpecificChain,
  SpecificChainTokens,
} from "../../types/index.js";
import { MultiChainProvider } from "../multi-chain.provider.js";

// Load environment variables for API access
dotenv.config();

// Skip tests if NOVES_API_KEY is not set
const apiKey = process.env.NOVES_API_KEY;
const runTests = !!apiKey;

// Mock logger for the constructor
const mockLogger: MockProxy<Logger> = mock<Logger>();

const specificChains: SpecificChain[] = ["arbitrum", "base", "eth"];

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
      multiChainProvider = new MultiChainProvider(
        { evmChains: specificChains, specificChainTokens },
        mockLogger,
      );
    }
  });

  describe("Direct provider tests with chain override", () => {
    it("should successfully fetch prices when providing the exact chain for at least one token", async () => {
      if (!runTests) {
        return;
      }

      // Track if at least one token worked correctly
      // TODO(stbrody): Why do we only need one token to be successful?  Shouldn't they all succeed?
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

          // Verify price format and chain information
          expect(typeof price?.price).toBe("number");
          expect(price?.price).toBeGreaterThan(0);
          expect(price.chain).toBe(BlockchainType.EVM);
          expect(price.specificChain).toBe(token.expectedChain);
        }
      }

      // Verify that at least one token worked
      expect(atLeastOneSuccess).toBe(true);
    }, 60000); // 60 second timeout for API calls
  });
});
