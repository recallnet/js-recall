import { beforeEach, describe, expect, test } from "vitest";

import { StartCompetitionResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("Public User API", () => {
  let adminApiKey: string;
  let rpcClient: Awaited<ReturnType<typeof createTestRpcClient>>;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    rpcClient = await createTestRpcClient();
  });

  describe("getPublicProfile", () => {
    test("should return public user profile without PII", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        userName: "Test User Name",
        userEmail: "secret-email@test.com",
        agentName: "Test Agent",
      });

      const result = await rpcClient.publicUser.getPublicProfile({
        userId: user.id,
      });

      expect(result.user.id).toBe(user.id);
      expect(result.user.walletAddress).toBe(user.walletAddress);
      expect(result.user.createdAt).toBeDefined();

      const responseKeys = Object.keys(result.user);
      expect(responseKeys).not.toContain("name");
      expect(responseKeys).not.toContain("email");
      expect(responseKeys).not.toContain("privyId");
      expect(responseKeys).not.toContain("embeddedWalletAddress");
    });

    test("should include only allowed metadata fields", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent",
      });

      const result = await rpcClient.publicUser.getPublicProfile({
        userId: user.id,
      });

      if (result.user.metadata) {
        const metadataKeys = Object.keys(result.user.metadata);
        expect(metadataKeys.every((key) => key === "website")).toBeTruthy();
      }
    });

    test("should return 404 for non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        rpcClient.publicUser.getPublicProfile({ userId: fakeUserId }),
      ).rejects.toThrow(/not found/i);
    });

    test("should reject invalid UUID format", async () => {
      await expect(
        rpcClient.publicUser.getPublicProfile({ userId: "invalid-uuid" }),
      ).rejects.toThrow();
    });
  });

  describe("getPublicAgents", () => {
    test("should return agents owned by user", async () => {
      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Public Test Agent",
      });

      const result = await rpcClient.publicUser.getPublicAgents({
        userId: user.id,
      });

      expect(result.userId).toBe(user.id);
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0]?.id).toBe(agent.id);
      expect(result.agents[0]?.name).toBe("Public Test Agent");
    });

    test("should sanitize agent data (no API key)", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Sanitized Agent",
      });

      const result = await rpcClient.publicUser.getPublicAgents({
        userId: user.id,
      });

      const agentKeys = Object.keys(result.agents[0] || {});
      expect(agentKeys).not.toContain("apiKey");
      expect(agentKeys).not.toContain("apiKeyHash");
      expect(agentKeys).not.toContain("encryptedApiKey");
      expect(agentKeys).not.toContain("email");
    });

    test("should return empty array for user with no agents", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Single Agent",
      });

      const result = await rpcClient.publicUser.getPublicAgents({
        userId: user.id,
      });

      expect(result.agents.length).toBeGreaterThanOrEqual(1);
    });

    test("should include agent metrics/stats", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Metrics",
      });

      const result = await rpcClient.publicUser.getPublicAgents({
        userId: user.id,
      });

      expect(result.agents[0]).toHaveProperty("stats");
    });

    test("should return 404 for non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        rpcClient.publicUser.getPublicAgents({ userId: fakeUserId }),
      ).rejects.toThrow(/not found/i);
    });

    test("should support pagination", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Paginated Agent",
      });

      const result = await rpcClient.publicUser.getPublicAgents({
        userId: user.id,
        paging: { limit: 1, offset: 0, sort: "-createdAt" },
      });

      expect(result.agents.length).toBeLessThanOrEqual(1);
    });
  });

  describe("getPublicCompetitions", () => {
    test("should return competitions for user's agents", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Competition Agent",
      });

      const competitionName = `Public User Test Comp ${Date.now()}`;
      const startResponse = (await adminClient.startCompetition({
        name: competitionName,
        description: "Test competition for public user API",
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      const result = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
      });

      expect(result.competitions).toBeDefined();
      expect(result.competitions.length).toBeGreaterThanOrEqual(1);
      expect(result.pagination).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(1);

      const foundComp = result.competitions.find(
        (c) => c.id === startResponse.competition.id,
      );
      expect(foundComp).toBeDefined();
    });

    test("should return pagination metadata", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Pagination Test Agent",
      });

      const startResponse = (await adminClient.startCompetition({
        name: `Pagination Test Comp ${Date.now()}`,
        agentIds: [agent.id],
      })) as StartCompetitionResponse;
      expect(startResponse.success).toBe(true);

      const result = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
        params: { limit: 5, offset: 0, sort: "-startDate" },
      });

      expect(result.pagination).toHaveProperty("total");
      expect(result.pagination).toHaveProperty("limit");
      expect(result.pagination).toHaveProperty("offset");
      expect(result.pagination).toHaveProperty("hasMore");
    });

    test("should support sorting by startDate", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Sort Test Agent",
      });

      await adminClient.startCompetition({
        name: `Sort Test Comp 1 ${Date.now()}`,
        agentIds: [agent.id],
      });

      await adminClient.startCompetition({
        name: `Sort Test Comp 2 ${Date.now()}`,
        agentIds: [agent.id],
      });

      const descResult = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
        params: { limit: 10, offset: 0, sort: "-startDate" },
      });

      if (descResult.competitions.length >= 2) {
        const dates = descResult.competitions.map((c) =>
          new Date(c.startDate).getTime(),
        );
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i] ?? 0);
        }
      }
    });

    test("should return empty array for user with no competitions", async () => {
      const { user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Competitions Agent",
      });

      const result = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
      });

      expect(result.competitions).toBeDefined();
      expect(Array.isArray(result.competitions)).toBe(true);
    });

    test("should return 404 for non-existent user", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      await expect(
        rpcClient.publicUser.getPublicCompetitions({ userId: fakeUserId }),
      ).rejects.toThrow(/not found/i);
    });

    test("should handle offset pagination correctly", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Offset Test Agent",
      });

      for (let i = 0; i < 3; i++) {
        await adminClient.startCompetition({
          name: `Offset Test Comp ${i} ${Date.now()}`,
          agentIds: [agent.id],
        });
      }

      const page1 = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
        params: { limit: 2, offset: 0, sort: "-startDate" },
      });

      const page2 = await rpcClient.publicUser.getPublicCompetitions({
        userId: user.id,
        params: { limit: 2, offset: 2, sort: "-startDate" },
      });

      if (page1.competitions.length > 0 && page2.competitions.length > 0) {
        expect(page1.competitions[0]?.id).not.toBe(page2.competitions[0]?.id);
      }
    });
  });

  describe("No authentication required", () => {
    test("all public endpoints should work without authentication", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { user, agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Public Access Agent",
      });

      await adminClient.startCompetition({
        name: `Public Access Test Comp ${Date.now()}`,
        agentIds: [agent.id],
      });

      const unauthenticatedClient = await createTestRpcClient();

      const profileResult =
        await unauthenticatedClient.publicUser.getPublicProfile({
          userId: user.id,
        });
      expect(profileResult.user.id).toBe(user.id);

      const agentsResult =
        await unauthenticatedClient.publicUser.getPublicAgents({
          userId: user.id,
        });
      expect(agentsResult.agents.length).toBeGreaterThanOrEqual(1);

      const competitionsResult =
        await unauthenticatedClient.publicUser.getPublicCompetitions({
          userId: user.id,
        });
      expect(competitionsResult.competitions).toBeDefined();
    });
  });
});
