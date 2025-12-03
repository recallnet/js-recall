import { beforeEach, describe, expect, test } from "vitest";

import {
  ErrorResponse,
  GetArenaResponse,
  ListArenasResponse,
  createTestClient,
  getAdminApiKey,
} from "@recallnet/test-utils";

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

    // List arenas using public endpoint
    const testClient = createTestClient();
    const listResponse = (await testClient.getArenas({
      limit: 20,
      offset: 0,
    })) as ListArenasResponse;

    expect(listResponse.success).toBe(true);
    expect(listResponse.arenas).toBeDefined();
    expect(Array.isArray(listResponse.arenas)).toBe(true);
    expect(listResponse.pagination).toBeDefined();
    expect(listResponse.pagination.total).toBeGreaterThan(0);

    // Verify our created arena is in the list
    const foundArena = listResponse.arenas.find((a) => a.id === arenaId);
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

    // Get arena using public endpoint
    const testClient = createTestClient();
    const getResponse = (await testClient.getArenaById(
      arenaId,
    )) as GetArenaResponse;

    expect(getResponse.success).toBe(true);
    expect(getResponse.arena).toBeDefined();
    expect(getResponse.arena.id).toBe(arenaId);
    expect(getResponse.arena.name).toBe("Test Arena for Get");
    expect(getResponse.arena.skill).toBe("perpetual_futures");
    expect(getResponse.arena.venues).toEqual(["hyperliquid"]);
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

    // List with name filter
    const testClient = createTestClient();
    const listResponse = (await testClient.getArenas({
      name: uniqueName,
    })) as ListArenasResponse;

    expect(listResponse.success).toBe(true);
    expect(listResponse.arenas.length).toBeGreaterThanOrEqual(2);

    // Verify both arenas are in the filtered results
    const arenaIds = listResponse.arenas.map((a) => a.id);
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
    const testClient = createTestClient();
    const page1 = (await testClient.getArenas({
      limit: 2,
      offset: 0,
    })) as ListArenasResponse;

    expect(page1.success).toBe(true);
    expect(page1.arenas.length).toBeLessThanOrEqual(2);
    expect(page1.pagination.limit).toBe(2);
    expect(page1.pagination.offset).toBe(0);

    // Get second page
    const page2 = (await testClient.getArenas({
      limit: 2,
      offset: 2,
    })) as ListArenasResponse;

    expect(page2.success).toBe(true);
    expect(page2.pagination.offset).toBe(2);
  });

  test("should return 404 for non-existent arena", async () => {
    const testClient = createTestClient();
    const response = await testClient.getArenaById("non-existent-arena-id");

    expect(response.success).toBe(false);
    expect((response as ErrorResponse).status).toBe(404);
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

    // Access without authentication
    const unauthClient = createTestClient();
    // DO NOT login

    const listResponse = (await unauthClient.getArenas()) as ListArenasResponse;
    expect(listResponse.success).toBe(true);

    const getResponse = (await unauthClient.getArenaById(
      arenaId,
    )) as GetArenaResponse;
    expect(getResponse.success).toBe(true);
    expect(getResponse.arena.id).toBe(arenaId);
  });
});
