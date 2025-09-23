import { beforeEach, describe, expect, it, vi } from "vitest";

import { RetryConfig } from "@/lib/retry-helper.js";
import { WatchlistService } from "@/lib/watchlist.js";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const TEST_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelay: 100,
  maxDelay: 1000,
  exponent: 2,
  maxElapsedTime: 5000,
};

// Mock the config module (override the Chainalysis API key)
vi.mock("@/config/index.js", () => ({
  config: {
    watchlist: {
      chainalysisApiKey: "",
    },
    logging: {
      level: "info",
    },
    server: {
      nodeEnv: "test",
    },
  },
}));

describe("WatchlistService", () => {
  let watchlistService: WatchlistService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { config } = await import("@/config/index.js");
    config.watchlist.chainalysisApiKey = "";
    watchlistService = new WatchlistService(TEST_RETRY_CONFIG);
  });

  describe("isConfigured", () => {
    it("should return false when API key is not set", () => {
      expect(watchlistService.isConfigured()).toBe(false);
    });

    it("should return true when API key is set", async () => {
      const { config } = await import("@/config/index.js");
      config.watchlist.chainalysisApiKey = "test-api-key";
      watchlistService = new WatchlistService(TEST_RETRY_CONFIG);
      expect(watchlistService.isConfigured()).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return service status", () => {
      const status = watchlistService.getStatus();
      expect(status).toEqual({
        configured: false,
        baseUrl: "https://public.chainalysis.com/api/v1/address",
        timeout: 10000,
      });
    });
  });

  describe("isAddressSanctioned", () => {
    beforeEach(async () => {
      const { config } = await import("@/config/index.js");
      config.watchlist.chainalysisApiKey = "test-api-key";
      watchlistService = new WatchlistService(TEST_RETRY_CONFIG);
    });

    it("should return false when API key is not configured", async () => {
      const { config } = await import("@/config/index.js");
      config.watchlist.chainalysisApiKey = "";
      watchlistService = new WatchlistService(TEST_RETRY_CONFIG);

      const result = await watchlistService.isAddressSanctioned(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return false for clean address", async () => {
      const cleanAddress = "0x1234567890abcdef1234567890abcdef12345678";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identifications: [],
        }),
      });

      const result = await watchlistService.isAddressSanctioned(cleanAddress);

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://public.chainalysis.com/api/v1/address/${cleanAddress}`,
        expect.objectContaining({
          method: "GET",
          headers: {
            "X-API-Key": "test-api-key",
            Accept: "application/json",
          },
        }),
      );
    });

    it("should return true for sanctioned address", async () => {
      const sanctionedAddress = "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identifications: [
            {
              category: "sanctions",
              name: "SANCTIONS: OFAC SDN Secondeye Solution 2021-04-15",
              description:
                "Pakistan-based Secondeye Solution (SES), also known as Forwarderz",
              url: "https://home.treasury.gov/news/press-releases/jy0126",
            },
          ],
        }),
      });

      const result =
        await watchlistService.isAddressSanctioned(sanctionedAddress);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://public.chainalysis.com/api/v1/address/${sanctionedAddress}`,
        expect.objectContaining({
          method: "GET",
          headers: {
            "X-API-Key": "test-api-key",
            Accept: "application/json",
          },
        }),
      );
    });

    it("should return false for address with non-sanctions identifications", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identifications: [
            {
              category: "exchange",
              name: "Binance",
              description: "Cryptocurrency exchange",
              url: null,
            },
          ],
        }),
      });

      const result = await watchlistService.isAddressSanctioned(address);
      expect(result).toBe(false);
    });

    it("should normalize address to lowercase", async () => {
      const mixedCaseAddress = "0x1DA5821544E25C636C1417BA96ADE4CF6D2F9B5A";
      const expectedLowercase = "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ identifications: [] }),
      });

      await watchlistService.isAddressSanctioned(mixedCaseAddress);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://public.chainalysis.com/api/v1/address/${expectedLowercase}`,
        expect.any(Object),
      );
    });

    it("should throw on API error", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      // Mock multiple rejections for retries (initial + 2 retries = 3 total)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

      await expect(
        watchlistService.isAddressSanctioned(address),
      ).rejects.toThrow("Retry attempts exhausted");
    }, 6000); // 6 second timeout (TEST_RETRY_CONFIG maxElapsedTime is 5 seconds)

    it("should throw on network error", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      // Mock multiple rejections for retries (initial + 2 retries = 3 total)
      // TypeError is what fetch throws for network errors
      mockFetch
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(
        watchlistService.isAddressSanctioned(address),
      ).rejects.toThrow("Retry attempts exhausted");
    }, 6000); // 6 second timeout (TEST_RETRY_CONFIG maxElapsedTime is 5 seconds)

    it("should handle timeout with AbortController", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";

      // Mock an aborted request - multiple times for retries (initial + 2 retries = 3 total)
      // Create proper AbortError objects
      const abortError = new Error("This operation was aborted");
      abortError.name = "AbortError";

      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError);

      await expect(
        watchlistService.isAddressSanctioned(address),
      ).rejects.toThrow("Retry attempts exhausted");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    }, 6000); // 6 second timeout (TEST_RETRY_CONFIG maxElapsedTime is 5 seconds)

    it("should handle empty identifications array", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identifications: null, // API might return null instead of empty array
        }),
      });

      const result = await watchlistService.isAddressSanctioned(address);
      expect(result).toBe(false);
    });

    it("should handle missing identifications property", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing identifications property
        }),
      });

      const result = await watchlistService.isAddressSanctioned(address);
      expect(result).toBe(false);
    });
  });
});
