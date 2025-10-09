import { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { MockProxy, mock } from "vitest-mock-extended";

import { PerpsProviderConfig } from "../../types/perps.js";
import { PerpsProviderFactory } from "../perps-provider.factory.js";
import { HyperliquidPerpsProvider } from "../perps/hyperliquid-perps.provider.js";
import { SymphonyPerpsProvider } from "../perps/symphony-perps.provider.js";

const mockLogger: MockProxy<Logger> = mock<Logger>();

describe("PerpsProviderFactory", () => {
  describe("createProvider", () => {
    it("should create Symphony provider for external_api type", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "symphony",
        apiUrl: "https://api.symphony.finance",
      };

      const provider = PerpsProviderFactory.createProvider(config, mockLogger);

      expect(provider).toBeInstanceOf(SymphonyPerpsProvider);
      expect(provider.getName()).toBe("Symphony");
    });

    it("should create Symphony provider without API URL", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "symphony",
      };

      const provider = PerpsProviderFactory.createProvider(config, mockLogger);

      expect(provider).toBeInstanceOf(SymphonyPerpsProvider);
    });

    it("should create Hyperliquid provider for external_api type", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "hyperliquid",
        apiUrl: "https://api.hyperliquid.xyz",
      };

      const provider = PerpsProviderFactory.createProvider(config, mockLogger);

      expect(provider).toBeInstanceOf(HyperliquidPerpsProvider);
      expect(provider.getName()).toBe("Hyperliquid");
    });

    it("should create Hyperliquid provider without API URL", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "hyperliquid",
      };

      const provider = PerpsProviderFactory.createProvider(config, mockLogger);

      expect(provider).toBeInstanceOf(HyperliquidPerpsProvider);
    });

    it("should throw error for unknown external API provider", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "unknown",
      };

      expect(() =>
        PerpsProviderFactory.createProvider(config, mockLogger),
      ).toThrow("Unknown external API provider: unknown");
    });

    it("should throw error for onchain_indexing type", () => {
      const config: PerpsProviderConfig = {
        type: "onchain_indexing",
        protocol: "gmx",
        chains: ["arbitrum"],
      };

      expect(() =>
        PerpsProviderFactory.createProvider(config, mockLogger),
      ).toThrow("On-chain indexing providers not yet implemented");
    });

    it("should throw error for hybrid type", () => {
      const config: PerpsProviderConfig = {
        type: "hybrid",
        primary: {
          type: "external_api",
          provider: "symphony",
        },
        fallback: {
          type: "external_api",
          provider: "hyperliquid",
        },
      };

      expect(() =>
        PerpsProviderFactory.createProvider(config, mockLogger),
      ).toThrow("Hybrid providers not yet implemented");
    });

    it("should throw error for unknown type", () => {
      const config = {
        type: "invalid_type",
      } as unknown as PerpsProviderConfig;

      expect(() =>
        PerpsProviderFactory.createProvider(config, mockLogger),
      ).toThrow("Unsupported perps data source type: invalid_type");
    });
  });

  describe("validateProvider", () => {
    it("should return true for healthy provider", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockResolvedValue(true),
        getAccountSummary: vi.fn(),
        getPositions: vi.fn(),
      };

      const result = await PerpsProviderFactory.validateProvider(
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
        getAccountSummary: vi.fn(),
        getPositions: vi.fn(),
      };

      const result = await PerpsProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(false);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });

    it("should return true for provider without health check", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        getAccountSummary: vi.fn(),
        getPositions: vi.fn(),
        // No isHealthy method
      };

      const result = await PerpsProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(true);
    });

    it("should return false when health check throws error", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockRejectedValue(new Error("Connection failed")),
        getAccountSummary: vi.fn(),
        getPositions: vi.fn(),
      };

      const result = await PerpsProviderFactory.validateProvider(
        mockProvider,
        mockLogger,
      );

      expect(result).toBe(false);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });
  });
});
