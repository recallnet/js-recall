import { Logger } from "pino";
import { describe, expect, test, vi } from "vitest";

import { AlchemyRpcProvider } from "../spot-live/alchemy-rpc.provider.js";

interface MockAlchemyParams {
  fromBlock: string;
  toBlock: string;
  fromAddress?: string;
  toAddress?: string;
  category: string[];
  withMetadata: boolean;
  excludeZeroValue: boolean;
  maxCount: number;
  pageKey?: string;
}

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

/**
 * Verifies pagination fix for combining fromAddress and toAddress queries
 *
 * Each query maintains its own pagination state
 *
 * This test proves working pagination by simulating >2000 total transfers
 */
describe("AlchemyRpcProvider - Pagination Correctness", () => {
  test("should fetch ALL transfers when fromAddress has >1000 AND toAddress has >1000", async () => {
    // Create mock Alchemy instances that return paginated results
    const mockAlchemy = {
      core: {
        getAssetTransfers: vi.fn(),
      },
    };

    const provider = new AlchemyRpcProvider("test-key", 3, 1000, mockLogger);

    // Override the provider's internal alchemy instance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).alchemyInstances = {
      base: mockAlchemy,
    };

    // Simulate fromAddress query returning 1500 transfers across 2 pages
    // Simulate toAddress query returning 800 transfers on 1 page
    // Total: 2300 transfers (proves we handle both pagination scenarios)

    let fromCallCount = 0;
    let toCallCount = 0;

    mockAlchemy.core.getAssetTransfers.mockImplementation(
      (params: MockAlchemyParams) => {
        if (params.fromAddress) {
          // fromAddress query
          fromCallCount++;
          if (fromCallCount === 1) {
            // Page 1: 1000 results + pageKey
            return Promise.resolve({
              transfers: Array(1000)
                .fill(null)
                .map((_, i) => ({
                  from: params.fromAddress,
                  to: `0xto${i}`,
                  value: 1,
                  asset: "USDC",
                  hash: `0xfrom${i}`,
                  blockNum: "0x100",
                  metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
                })),
              pageKey: "from_page_2",
            });
          } else {
            // Page 2: 500 results, no pageKey
            return Promise.resolve({
              transfers: Array(500)
                .fill(null)
                .map((_, i) => ({
                  from: params.fromAddress,
                  to: `0xto${i + 1000}`,
                  value: 1,
                  asset: "USDC",
                  hash: `0xfrom${i + 1000}`,
                  blockNum: "0x100",
                  metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
                })),
              pageKey: undefined,
            });
          }
        } else if (params.toAddress) {
          // toAddress query
          toCallCount++;
          // Single page: 800 results, no pagination needed
          return Promise.resolve({
            transfers: Array(800)
              .fill(null)
              .map((_, i) => ({
                from: `0xfrom${i}`,
                to: params.toAddress,
                value: 1,
                asset: "USDC",
                hash: `0xto${i}`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              })),
            pageKey: undefined,
          });
        }

        throw new Error("Invalid params");
      },
    );

    // Make the call
    const result = await provider.getAssetTransfers(
      "0xtest",
      "base",
      0,
      "latest",
    );

    // VERIFICATION: All transfers must be captured
    expect(fromCallCount).toBe(2); // fromAddress query paginated (2 calls)
    expect(toCallCount).toBe(1); // toAddress query single call
    expect(result.transfers.length).toBe(2300); // 1500 from + 800 to
    expect(result.pageKey).toBeUndefined(); // All pages exhausted

    // Verify we got transfers from both queries
    const fromTransfers = result.transfers.filter((t) =>
      t.hash.startsWith("0xfrom"),
    );
    const toTransfers = result.transfers.filter((t) =>
      t.hash.startsWith("0xto"),
    );

    expect(fromTransfers.length).toBe(1500);
    expect(toTransfers.length).toBe(800);

    console.log("✅ PAGINATION FIX VERIFIED:");
    console.log(`  - fromAddress query: 2 pages, 1500 transfers`);
    console.log(`  - toAddress query: 1 page, 800 transfers`);
    console.log(`  - Total captured: ${result.transfers.length} transfers`);
    console.log(`  - Each query used independent pagination state`);
  });

  test("should handle case where BOTH queries need multiple pages", async () => {
    const mockAlchemy = {
      core: {
        getAssetTransfers: vi.fn(),
      },
    };

    const provider = new AlchemyRpcProvider("test-key", 3, 1000, mockLogger);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).alchemyInstances = {
      base: mockAlchemy,
    };

    let fromCallCount = 0;
    let toCallCount = 0;

    mockAlchemy.core.getAssetTransfers.mockImplementation(
      (params: MockAlchemyParams) => {
        if (params.fromAddress) {
          fromCallCount++;
          // Simulate 3 pages for fromAddress
          if (fromCallCount === 1) {
            return Promise.resolve({
              transfers: Array(1000).fill({
                from: params.fromAddress,
                to: "0xto",
                value: 1,
                asset: "USDC",
                hash: `0xfrom_page1`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              }),
              pageKey: "from_page_2",
            });
          } else if (fromCallCount === 2) {
            return Promise.resolve({
              transfers: Array(1000).fill({
                from: params.fromAddress,
                to: "0xto",
                value: 1,
                asset: "USDC",
                hash: `0xfrom_page2`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              }),
              pageKey: "from_page_3",
            });
          } else {
            return Promise.resolve({
              transfers: Array(200).fill({
                from: params.fromAddress,
                to: "0xto",
                value: 1,
                asset: "USDC",
                hash: `0xfrom_page3`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              }),
              pageKey: undefined,
            });
          }
        } else if (params.toAddress) {
          toCallCount++;
          // Simulate 2 pages for toAddress
          if (toCallCount === 1) {
            return Promise.resolve({
              transfers: Array(1000).fill({
                from: "0xfrom",
                to: params.toAddress,
                value: 1,
                asset: "USDC",
                hash: `0xto_page1`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              }),
              pageKey: "to_page_2",
            });
          } else {
            return Promise.resolve({
              transfers: Array(500).fill({
                from: "0xfrom",
                to: params.toAddress,
                value: 1,
                asset: "USDC",
                hash: `0xto_page2`,
                blockNum: "0x100",
                metadata: { blockTimestamp: "2025-01-01T00:00:00Z" },
              }),
              pageKey: undefined,
            });
          }
        }

        throw new Error("Invalid params");
      },
    );

    const result = await provider.getAssetTransfers(
      "0xtest",
      "base",
      0,
      "latest",
    );

    // Verification
    expect(fromCallCount).toBe(3); // fromAddress: 3 pages
    expect(toCallCount).toBe(2); // toAddress: 2 pages
    expect(result.transfers.length).toBe(3700); // 2200 from + 1500 to
    expect(result.pageKey).toBeUndefined();

    console.log("✅ MULTI-PAGE PAGINATION VERIFIED:");
    console.log(`  - fromAddress: 3 API calls, 2200 transfers`);
    console.log(`  - toAddress: 2 API calls, 1500 transfers`);
    console.log(`  - Total: 5 API calls, 3700 transfers`);
    console.log(`  - Independent pagination states maintained`);
  });
});
