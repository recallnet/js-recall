import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SanctionedWalletRepository } from "@recallnet/db/repositories/sanctioned-wallet";

import { RetryConfig, RetryExhaustedError } from "../retry-helper.js";
import { WalletWatchlist } from "../watchlist.js";

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
      mode: "api",
      apiUrl: "https://public.chainalysis.com/api/v1/address",
      apiKey: "test-api-key",
    },
    logging: {
      level: "info",
    },
    server: {
      nodeEnv: "test",
    },
  },
}));

// Test sanctioned addresses
const SANCTIONED_TEST_ADDRESSES = [
  "0x04dba1194ee10112fe6c3207c0687def0e78bacf",
  "0x08723392ed15743cc38513c4925f5e6be5c17243",
  "0x08b2efdcdb8822efe5ad0eae55517cf5dc544251",
];

describe("WatchlistService", () => {
  let watchlistService: WalletWatchlist;
  const logger = pino.default();
  let mockDbRepository: SanctionedWalletRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock database repository
    mockDbRepository = {
      isSanctioned: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      getAll: vi.fn(),
      areSanctioned: vi.fn(),
    } as unknown as SanctionedWalletRepository;

    watchlistService = new WalletWatchlist(
      {
        watchlist: {
          mode: "api",
          apiUrl: "https://public.chainalysis.com/api/v1/address",
          apiKey: "test-api-key",
        },
      },
      logger,
      mockDbRepository,
      TEST_RETRY_CONFIG,
    );
  });

  describe("isApiConfigured", () => {
    it("should return false when API key is not set", () => {
      watchlistService = new WalletWatchlist(
        {
          watchlist: {
            mode: "api",
            apiUrl: "https://public.chainalysis.com/api/v1/address",
            apiKey: "",
          },
        },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );
      expect(watchlistService.isApiConfigured()).toBe(false);
    });

    it("should return true when API key is set", async () => {
      watchlistService = new WalletWatchlist(
        {
          watchlist: {
            mode: "api",
            apiUrl: "https://public.chainalysis.com/api/v1/address",
            apiKey: "test-api-key",
          },
        },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );
      expect(watchlistService.isApiConfigured()).toBe(true);
    });
  });

  describe("getStatus", () => {
    it("should return service status with all modes", () => {
      watchlistService = new WalletWatchlist(
        {
          watchlist: {
            mode: "hybrid",
            apiUrl: "https://public.chainalysis.com/api/v1/address",
            apiKey: "",
          },
        },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );
      const status = watchlistService.getStatus();
      expect(status).toEqual({
        mode: "hybrid",
        apiConfigured: false,
        databaseConfigured: true,
        baseUrl: "https://public.chainalysis.com/api/v1/address",
        timeout: 10000,
      });
    });
  });

  describe("isAddressSanctioned", () => {
    it("should throw error when API key is not configured for API mode", async () => {
      watchlistService = new WalletWatchlist(
        { watchlist: { apiKey: "", apiUrl: "", mode: "api" } },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );

      const result = watchlistService.isAddressSanctioned(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      await expect(result).rejects.toThrow("API key not configured");
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
      ).rejects.toThrow(RetryExhaustedError);
    }, 6000);

    it("should retry on 403 from Chainalysis", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      watchlistService = new WalletWatchlist(
        {
          watchlist: {
            apiKey: "test-api-key",
            apiUrl: "https://public.chainalysis.com/api/v1/address",
            mode: "api",
          },
        },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );

      // Mock 403 responses for all attempts (initial + maxRetries from DEFAULT_RETRY_CONFIG)
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      // Should throw after exhausting retries
      await expect(
        watchlistService.isAddressSanctioned(address),
      ).rejects.toThrow();

      // Should be called 3 times (initial + 2 retries from TEST_RETRY_CONFIG)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 7000);

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
      ).rejects.toThrow(RetryExhaustedError);
    }, 6000);

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
      ).rejects.toThrow(RetryExhaustedError);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    }, 6000);

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

  describe("Watchlist modes", () => {
    describe("API", () => {
      beforeEach(() => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "api",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "test-api-key",
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );
      });

      it("should use API only in API mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            identifications: [],
          }),
        });

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockFetch).toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });

      it("should return true for sanctioned address in API mode", async () => {
        const address = SANCTIONED_TEST_ADDRESSES[0];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            identifications: [
              {
                category: "sanctions",
                name: "OFAC SDN",
                description: "Specially Designated National",
              },
            ],
          }),
        });

        const result = await watchlistService.isAddressSanctioned(address!);

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });

      it("should throw when API fails in API mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        // Mock API failures for all retry attempts
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
        ).rejects.toThrow(RetryExhaustedError);
        expect(mockFetch).toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      }, 6000);

      it("should throw when API times out in API mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        // Mock timeout errors for all retry attempts
        const abortError = new Error("This operation was aborted");
        abortError.name = "AbortError";

        mockFetch
          .mockRejectedValueOnce(abortError)
          .mockRejectedValueOnce(abortError)
          .mockRejectedValueOnce(abortError);

        await expect(
          watchlistService.isAddressSanctioned(address),
        ).rejects.toThrow(RetryExhaustedError);
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      }, 6000);

      it("should throw when API not configured in API mode", async () => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "api",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "", // No API key
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );

        const address = "0x1234567890abcdef1234567890abcdef12345678";

        await expect(
          watchlistService.isAddressSanctioned(address),
        ).rejects.toThrow("API key not configured");
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });
    });

    describe("Database", () => {
      beforeEach(() => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "database",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "",
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );
      });

      it("should check database in database mode", async () => {
        const address = SANCTIONED_TEST_ADDRESSES[0];
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(true);

        const result = await watchlistService.isAddressSanctioned(address!);

        expect(result).toBe(true);
        expect(mockDbRepository.isSanctioned).toHaveBeenCalledWith(
          address?.toLowerCase(),
        );
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should return false for non-sanctioned address in database mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(false);

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockDbRepository.isSanctioned).toHaveBeenCalledWith(
          address.toLowerCase(),
        );
      });

      it("should throw on database error", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";
        const dbError = new Error("Database connection failed");
        vi.mocked(mockDbRepository.isSanctioned).mockRejectedValueOnce(dbError);

        await expect(
          watchlistService.isAddressSanctioned(address),
        ).rejects.toThrow("Database connection failed");
      });
    });

    describe("Hybrid", () => {
      beforeEach(() => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "hybrid",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "test-api-key",
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );
      });

      it("should use API first in hybrid mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            identifications: [],
          }),
        });

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockFetch).toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });

      it("should fallback to database when API fails in hybrid mode", async () => {
        const address = SANCTIONED_TEST_ADDRESSES[0];

        // Mock API failures for all retry attempts
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

        // Mock database returning sanctioned
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(true);

        const result = await watchlistService.isAddressSanctioned(address!);

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).toHaveBeenCalledWith(
          address?.toLowerCase(),
        );
      }, 6000);

      it("should fallback to database when API times out", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        // Mock timeout errors for all retry attempts
        const abortError = new Error("This operation was aborted");
        abortError.name = "AbortError";

        mockFetch
          .mockRejectedValueOnce(abortError)
          .mockRejectedValueOnce(abortError)
          .mockRejectedValueOnce(abortError);

        // Mock database returning not sanctioned
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(false);

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockDbRepository.isSanctioned).toHaveBeenCalled();
      }, 6000);

      it("should use database when API not configured in hybrid mode", async () => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "hybrid",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "", // No API key
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );

        const address = SANCTIONED_TEST_ADDRESSES[1];
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(true);

        const result = await watchlistService.isAddressSanctioned(address!);

        expect(result).toBe(true);
        expect(mockDbRepository.isSanctioned).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should throw when both API and database fail in hybrid mode", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        // Mock API failures
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

        // Mock database failure
        const dbError = new Error("Database connection failed");
        vi.mocked(mockDbRepository.isSanctioned).mockRejectedValueOnce(dbError);

        await expect(
          watchlistService.isAddressSanctioned(address),
        ).rejects.toThrow("Database connection failed");
      }, 6000);
    });

    describe("None", () => {
      beforeEach(() => {
        watchlistService = new WalletWatchlist(
          {
            watchlist: {
              mode: "none",
              apiUrl: "https://public.chainalysis.com/api/v1/address",
              apiKey: "",
            },
          },
          logger,
          mockDbRepository,
          TEST_RETRY_CONFIG,
        );
      });

      it("should skip all checks and return false (not sanctioned)", async () => {
        const address = "0x1234567890abcdef1234567890abcdef12345678";

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });

      it("should allow sanctioned addresses when checks are disabled", async () => {
        const address = SANCTIONED_TEST_ADDRESSES[0]!;

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });

      it("should work with any address including invalid formats", async () => {
        const invalidAddress = "not-a-valid-address";

        const result =
          await watchlistService.isAddressSanctioned(invalidAddress);

        expect(result).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockDbRepository.isSanctioned).not.toHaveBeenCalled();
      });
    });

    it("should throw on invalid mode", async () => {
      // Note: we want to test this breaking type safety
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidMode = "invalid-mode" as any;
      watchlistService = new WalletWatchlist(
        { watchlist: { mode: invalidMode, apiUrl: "", apiKey: "" } },
        logger,
        mockDbRepository,
      );

      await expect(
        watchlistService.isAddressSanctioned("0x123..."),
      ).rejects.toThrow("Unhandled watchlist mode");
    });
  });

  describe("Test Addresses", () => {
    it("should recognize known sanctioned addresses from test data", async () => {
      watchlistService = new WalletWatchlist(
        {
          watchlist: {
            mode: "database",
            apiUrl: "https://public.chainalysis.com/api/v1/address",
            apiKey: "",
          },
        },
        logger,
        mockDbRepository,
        TEST_RETRY_CONFIG,
      );

      for (const address of SANCTIONED_TEST_ADDRESSES) {
        vi.mocked(mockDbRepository.isSanctioned).mockResolvedValueOnce(true);

        const result = await watchlistService.isAddressSanctioned(address);

        expect(result).toBe(true);
        expect(mockDbRepository.isSanctioned).toHaveBeenCalledWith(
          address.toLowerCase(),
        );
      }
    });
  });
});
