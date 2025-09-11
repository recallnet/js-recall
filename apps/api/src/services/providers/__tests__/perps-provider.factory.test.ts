import { describe, expect, it, vi } from "vitest";

import { PerpsProviderFactory } from "@/services/providers/perps-provider.factory.js";
import { SymphonyPerpsProvider } from "@/services/providers/perps/symphony-perps.provider.js";
import { PerpsProviderConfig } from "@/types/perps.js";

// Mock logger to avoid console noise
vi.mock("@/lib/logger.js", () => ({
  serviceLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PerpsProviderFactory", () => {
  describe("createProvider", () => {
    it("should create Symphony provider for external_api type", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "symphony",
        apiUrl: "https://api.symphony.finance",
      };

      const provider = PerpsProviderFactory.createProvider(config);

      expect(provider).toBeInstanceOf(SymphonyPerpsProvider);
      expect(provider.getName()).toBe("Symphony");
    });

    it("should create Symphony provider without API URL", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "symphony",
      };

      const provider = PerpsProviderFactory.createProvider(config);

      expect(provider).toBeInstanceOf(SymphonyPerpsProvider);
    });

    it("should throw error for unimplemented hyperliquid provider", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "hyperliquid",
      };

      expect(() => PerpsProviderFactory.createProvider(config)).toThrow(
        "Hyperliquid provider not yet implemented",
      );
    });

    it("should throw error for unknown external API provider", () => {
      const config: PerpsProviderConfig = {
        type: "external_api",
        provider: "unknown",
      };

      expect(() => PerpsProviderFactory.createProvider(config)).toThrow(
        "Unknown external API provider: unknown",
      );
    });

    it("should throw error for onchain_indexing type", () => {
      const config: PerpsProviderConfig = {
        type: "onchain_indexing",
        protocol: "gmx",
        chains: ["arbitrum"],
      };

      expect(() => PerpsProviderFactory.createProvider(config)).toThrow(
        "On-chain indexing providers not yet implemented",
      );
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

      expect(() => PerpsProviderFactory.createProvider(config)).toThrow(
        "Hybrid providers not yet implemented",
      );
    });

    it("should throw error for unknown type", () => {
      const config = {
        type: "invalid_type",
      } as unknown as PerpsProviderConfig;

      expect(() => PerpsProviderFactory.createProvider(config)).toThrow(
        "Unsupported perps data source type: invalid_type",
      );
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

      const result = await PerpsProviderFactory.validateProvider(mockProvider);

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

      const result = await PerpsProviderFactory.validateProvider(mockProvider);

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

      const result = await PerpsProviderFactory.validateProvider(mockProvider);

      expect(result).toBe(true);
    });

    it("should return false when health check throws error", async () => {
      const mockProvider = {
        getName: () => "TestProvider",
        isHealthy: vi.fn().mockRejectedValue(new Error("Connection failed")),
        getAccountSummary: vi.fn(),
        getPositions: vi.fn(),
      };

      const result = await PerpsProviderFactory.validateProvider(mockProvider);

      expect(result).toBe(false);
      expect(mockProvider.isHealthy).toHaveBeenCalledOnce();
    });
  });
});
