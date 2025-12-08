import { beforeEach, describe, expect, test } from "vitest";

import { createTestClient, getAdminApiKey } from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("Arena API", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("should list all arenas", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a test arena
    const arenaId = `test-arena-${Date.now()}`;
    const createResponse = await adminClient.createArena({
      id: arenaId,
      name: "Test Arena for Listing",
      category: "crypto_trading",
      skill: "spot_paper_trading",
      createdBy: "test-admin",
    });
    expect(createResponse.success).toBe(true);

    // List arenas using RPC (public access, no auth needed)
    const rpcClient = await createTestRpcClient();
    const { arenas, pagination } = await rpcClient.arena.list({
      limit: 20,
      offset: 0,
    });

    expect(arenas).toBeDefined();
    expect(Array.isArray(arenas)).toBe(true);
    expect(pagination).toBeDefined();
    expect(pagination.total).toBeGreaterThan(0);

    // Verify our created arena is in the list
    const foundArena = arenas.find((a) => a.id === arenaId);
    expect(foundArena).toBeDefined();
    expect(foundArena?.name).toBe("Test Arena for Listing");
  });

  test("should get arena by ID", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a test arena
    const arenaId = `test-arena-${Date.now()}`;
    const createResponse = await adminClient.createArena({
      id: arenaId,
      name: "Test Arena for Get",
      category: "crypto_trading",
      skill: "perpetual_futures",
      createdBy: "test-admin",
      venues: ["hyperliquid"],
    });
    expect(createResponse.success).toBe(true);

    // Get arena using RPC (public access, no auth needed)
    const rpcClient = await createTestRpcClient();
    const arena = await rpcClient.arena.getById({ id: arenaId });

    expect(arena).toBeDefined();
    expect(arena.id).toBe(arenaId);
    expect(arena.name).toBe("Test Arena for Get");
    expect(arena.skill).toBe("perpetual_futures");
    expect(arena.venues).toEqual(["hyperliquid"]);
  });

  test("should filter arenas by name", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create test arenas
    const uniqueName = `UniqueArenaName${Date.now()}`;
    const arena1Id = `test-arena-1-${Date.now()}`;
    await adminClient.createArena({
      id: arena1Id,
      name: `${uniqueName} First`,
      category: "crypto_trading",
      skill: "spot_paper_trading",
      createdBy: "test-admin",
    });

    const arena2Id = `test-arena-2-${Date.now()}`;
    await adminClient.createArena({
      id: arena2Id,
      name: `${uniqueName} Second`,
      category: "crypto_trading",
      skill: "spot_paper_trading",
      createdBy: "test-admin",
    });

    // List with name filter using RPC
    const rpcClient = await createTestRpcClient();
    const { arenas } = await rpcClient.arena.list({
      name: uniqueName,
    });

    expect(arenas.length).toBeGreaterThanOrEqual(2);

    // Verify both arenas are in the filtered results
    const arenaIds = arenas.map((a) => a.id);
    expect(arenaIds).toContain(arena1Id);
    expect(arenaIds).toContain(arena2Id);
  });

  test("should handle pagination for arenas", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create multiple arenas
    const timestamp = Date.now();
    for (let i = 0; i < 3; i++) {
      await adminClient.createArena({
        id: `pagination-arena-${timestamp}-${i}`,
        name: `Pagination Arena ${i}`,
        category: "crypto_trading",
        skill: "spot_paper_trading",
        createdBy: "test-admin",
      });
    }

    // Get first page
    const rpcClient = await createTestRpcClient();
    const page1 = await rpcClient.arena.list({
      limit: 2,
      offset: 0,
    });

    expect(page1.arenas.length).toBeLessThanOrEqual(2);
    expect(page1.pagination.limit).toBe(2);
    expect(page1.pagination.offset).toBe(0);

    // Get second page
    const page2 = await rpcClient.arena.list({
      limit: 2,
      offset: 2,
    });

    expect(page2.pagination.offset).toBe(2);
  });

  test("should return 404 for non-existent arena", async () => {
    const rpcClient = await createTestRpcClient();

    await expect(
      rpcClient.arena.getById({ id: "non-existent-arena-id" }),
    ).rejects.toThrow(/not found/i);
  });

  test("should allow unauthenticated access to public arena endpoints", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a test arena
    const arenaId = `public-arena-${Date.now()}`;
    await adminClient.createArena({
      id: arenaId,
      name: "Public Test Arena",
      category: "crypto_trading",
      skill: "spot_paper_trading",
      createdBy: "test-admin",
    });

    // Access without authentication using RPC
    const rpcClient = await createTestRpcClient();

    const { arenas } = await rpcClient.arena.list({});
    expect(arenas).toBeDefined();

    const arena = await rpcClient.arena.getById({ id: arenaId });
    expect(arena.id).toBe(arenaId);
  });
});
