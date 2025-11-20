import { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { SpecificChain } from "../../types/index.js";
import {
  ProtocolFilter,
  SpotLiveProviderConfig,
} from "../../types/spot-live.js";
import { SpotLiveProviderFactory } from "../spot-live-provider.factory.js";
import { RpcSpotProvider } from "../spot-live/rpc-spot.provider.js";

// Mock environment variables
vi.stubEnv("ALCHEMY_API_KEY", "test-alchemy-key");

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("SpotLiveProviderFactory", () => {
  describe("createProvider", () => {
    it("should create RPC direct provider with Alchemy", () => {
      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        provider: "alchemy",
        rpcUrls: {
          base: "https://base-mainnet.g.alchemy.com/v2/test",
        },
        chains: ["base"],
      };

      const provider = SpotLiveProviderFactory.createProvider(
        config,
        [],
        mockLogger,
      );

      expect(provider).toBeInstanceOf(RpcSpotProvider);
      expect(provider.getName()).toContain("Alchemy");
    });

    it("should create provider with protocol filters", () => {
      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        provider: "alchemy",
        rpcUrls: {
          base: "https://base-mainnet.g.alchemy.com/v2/test",
        },
        chains: ["base"],
      };

      const protocolFilters: ProtocolFilter[] = [
        {
          protocol: "aerodrome",
          chain: "base" as SpecificChain,
          routerAddress: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
          swapEventSignature:
            "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
          factoryAddress: "0x420DD381b31aEf6683db6B902084cB0ffECe40Da",
        },
      ];

      const provider = SpotLiveProviderFactory.createProvider(
        config,
        protocolFilters,
        mockLogger,
      );

      expect(provider).toBeInstanceOf(RpcSpotProvider);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "rpc_direct",
          provider: "alchemy",
          protocolFiltersCount: 1,
        }),
        expect.stringContaining("Creating provider"),
      );
    });

    it("should throw error when provider name is missing for rpc_direct", () => {
      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        rpcUrls: {
          base: "https://base-mainnet.g.alchemy.com/v2/test",
        },
        chains: ["base"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("Provider name required for rpc_direct type");
    });

    it("should throw error when RPC URLs are missing", () => {
      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        provider: "alchemy",
        chains: ["base"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("RPC URLs required for rpc_direct provider");
    });

    it("should throw error when API key is not in environment", () => {
      vi.stubEnv("ALCHEMY_API_KEY", "");

      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        provider: "alchemy",
        rpcUrls: {
          base: "https://base-mainnet.g.alchemy.com/v2/test",
        },
        chains: ["base"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("API key not found for alchemy");

      // Restore for other tests
      vi.stubEnv("ALCHEMY_API_KEY", "test-alchemy-key");
    });

    it("should throw error for QuickNode provider (not implemented)", () => {
      vi.stubEnv("QUICKNODE_API_KEY", "test-quicknode-key");

      const config: SpotLiveProviderConfig = {
        type: "rpc_direct",
        provider: "quicknode",
        rpcUrls: {
          base: "https://base-mainnet.quiknode.pro/test",
        },
        chains: ["base"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("QuickNode provider not yet implemented");
    });

    it("should throw error for envio_indexing type", () => {
      const config: SpotLiveProviderConfig = {
        type: "envio_indexing",
        graphqlUrl: "https://indexer.envio.dev/test",
        chains: ["base", "arbitrum"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("Envio indexing providers not yet implemented");
    });

    it("should throw error for hybrid type", () => {
      const config: SpotLiveProviderConfig = {
        type: "hybrid",
        chains: ["base"],
      };

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("Hybrid providers not yet implemented");
    });

    it("should throw error for unknown type", () => {
      const config = {
        type: "invalid_type",
        chains: ["base"],
      } as unknown as SpotLiveProviderConfig;

      expect(() =>
        SpotLiveProviderFactory.createProvider(config, [], mockLogger),
      ).toThrow("Unsupported spot live data source type: invalid_type");
    });
  });

  describe("validateProvider", () => {
    it("should return true for healthy provider", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockResolvedValue(true),
        getTradesSince: vi.fn(),
      };

      const result = await SpotLiveProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(true);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });

    it("should return false for unhealthy provider", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockResolvedValue(false),
        getTradesSince: vi.fn(),
      };

      const result = await SpotLiveProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(false);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });

    it("should return true for provider without health check", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        getTradesSince: vi.fn(),
        // No isHealthy method
      };

      const result = await SpotLiveProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(true);
    });

    it("should return false when health check throws error", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockRejectedValue(new Error("Connection failed")),
        getTradesSince: vi.fn(),
      };

      const result = await SpotLiveProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(false);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });
  });
});
