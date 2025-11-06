import { beforeEach, describe, expect, test } from "vitest";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import {
  type CompetitionBoostsResponse,
  connectToDb,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
} from "@recallnet/test-utils";

// Helper to get boost dates (now to 24h from now)
const getBoostDates = () => {
  const now = new Date().toISOString();
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { boostStartDate: now, boostEndDate: futureDate };
};

// Helper to create a boost directly using the repository
const createBoostDirectly = async (
  userId: string,
  walletAddress: string,
  competitionId: string,
  agentId: string,
  amount: bigint,
) => {
  const db = await connectToDb();
  const boostRepository = new BoostRepository(db);

  // First, give the user boost balance
  await boostRepository.increase({
    userId,
    wallet: walletAddress,
    competitionId,
    amount,
  });

  // Then boost the agent
  await boostRepository.boostAgent({
    userId,
    wallet: walletAddress,
    agentId,
    competitionId,
    amount,
  });
};

describe("Boost API", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  describe("GET /api/competitions/:competitionId/boosts/all", () => {
    test("should return empty list when no boosts exist", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Test Competition ${Date.now()}`,
        ...getBoostDates(),
      });
      const competitionId = createResponse.competition.id;

      // Get boosts (should be empty)
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toEqual([]);
      expect(response.pagination).toEqual({
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    });

    test("should return boost records with agent information", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create users and agents
      const { agent: agent1, user: user1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Alpha Trader",
        });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Beta Trader",
      });
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Boost Test Competition ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      await startExistingTestCompetition({
        adminClient,
        competitionId,
        agentIds: [agent1.id, agent2.id],
      });

      // Create boost directly using repository (Express API doesn't have boost creation endpoints)
      const boostAmount = 500000000000000000000n; // 500 BOOST
      await createBoostDirectly(
        user1.id,
        user1.walletAddress,
        competitionId,
        agent1.id,
        boostAmount,
      );

      // Get all boosts
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(1);

      const boost = response.data.items[0];
      expect(boost).toBeDefined();
      expect(boost!.agentId).toBe(agent1.id);
      expect(boost!.agentName).toBe("Alpha Trader");
      expect(boost!.agentHandle).toBeDefined();
      expect(boost!.amount).toBe(boostAmount.toString());
      expect(boost!.wallet).toMatch(/^0x[0-9a-f]{40}$/);
      expect(boost!.wallet.toLowerCase()).toBe(
        user1.walletAddress.toLowerCase(),
      );
      expect(boost!.createdAt).toBeDefined();
      expect(new Date(boost!.createdAt).getTime()).toBeGreaterThan(0);

      expect(response.pagination).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
    });

    test("should return multiple boosts in correct order", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create users and agents
      const { agent: agent1, user: user1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent One",
        });

      const { agent: agent2, user: user2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Two",
        });

      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Three",
      });
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Multi Boost Competition ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      await startExistingTestCompetition({
        adminClient,
        competitionId,
        agentIds: [agent1.id, agent2.id, agent3.id],
      });

      // Create boosts directly using repository
      await createBoostDirectly(
        user1.id,
        user1.walletAddress,
        competitionId,
        agent1.id,
        300000000000000000000n,
      );

      await createBoostDirectly(
        user1.id,
        user1.walletAddress,
        competitionId,
        agent2.id,
        200000000000000000000n,
      );

      await createBoostDirectly(
        user2.id,
        user2.walletAddress,
        competitionId,
        agent3.id,
        150000000000000000000n,
      );

      // Get all boosts
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(3);

      // Should be ordered by createdAt DESC (most recent first)
      const boosts = response.data.items;
      expect(boosts[0]?.amount).toBe("150000000000000000000"); // Last boost
      expect(boosts[1]?.amount).toBe("200000000000000000000");
      expect(boosts[2]?.amount).toBe("300000000000000000000"); // First boost

      // Verify agent information is included
      boosts.forEach((boost) => {
        expect(boost.agentName).toBeTruthy();
        expect(boost.agentHandle).toBeTruthy();
      });

      expect(response.pagination.total).toBe(3);
      expect(response.pagination.hasMore).toBe(false);
    });

    test("should support pagination with limit and offset", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { agent: agent1, user: user1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Test Agent",
        });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Test Agent 2",
      });
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Pagination Test Competition ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      await startExistingTestCompetition({
        adminClient,
        competitionId,
        agentIds: [agent1.id, agent2.id],
      });

      // Create 5 boosts directly using repository
      for (let i = 0; i < 5; i++) {
        await createBoostDirectly(
          user1.id,
          user1.walletAddress,
          competitionId,
          agent1.id,
          BigInt(100 * (i + 1)) * 1000000000000000000n,
        );
      }

      // Get first page (limit 2)
      const page1Response = (await adminClient.getCompetitionBoosts(
        competitionId,
        2,
        0,
      )) as CompetitionBoostsResponse;

      expect(page1Response.data.items).toHaveLength(2);
      expect(page1Response.pagination).toEqual({
        total: 5,
        limit: 2,
        offset: 0,
        hasMore: true,
      });

      // Get second page
      const page2Response = (await adminClient.getCompetitionBoosts(
        competitionId,
        2,
        2,
      )) as CompetitionBoostsResponse;

      expect(page2Response.data.items).toHaveLength(2);
      expect(page2Response.pagination).toEqual({
        total: 5,
        limit: 2,
        offset: 2,
        hasMore: true,
      });

      // Get third page (only 1 item left)
      const page3Response = (await adminClient.getCompetitionBoosts(
        competitionId,
        2,
        4,
      )) as CompetitionBoostsResponse;

      expect(page3Response.data.items).toHaveLength(1);
      expect(page3Response.pagination).toEqual({
        total: 5,
        limit: 2,
        offset: 4,
        hasMore: false,
      });
    });

    test("should use default values for limit and offset when not provided", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Defaults Test ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      // Get boosts without query params
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.pagination.limit).toBe(50); // Default limit
      expect(response.pagination.offset).toBe(0); // Default offset
    });

    test("should handle non-existent competition gracefully", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const fakeCompetitionId = "00000000-0000-0000-0000-000000000000";

      const response = (await adminClient.getCompetitionBoosts(
        fakeCompetitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toEqual([]);
      expect(response.pagination.total).toBe(0);
    });

    test("should include all required fields in response", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { agent, user } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Fields Test Agent",
      });
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Fields Test Competition ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      await startExistingTestCompetition({
        adminClient,
        competitionId,
        agentIds: [agent.id],
      });

      // Create boost directly using repository
      await createBoostDirectly(
        user.id,
        user.walletAddress,
        competitionId,
        agent.id,
        250000000000000000000n,
      );

      // Get boosts
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      const boost = response.data.items[0];

      expect(boost).toBeDefined();
      expect(typeof boost!.userId).toBe("string");
      expect(typeof boost!.wallet).toBe("string");
      expect(typeof boost!.agentId).toBe("string");
      expect(typeof boost!.agentName).toBe("string");
      expect(typeof boost!.agentHandle).toBe("string");
      expect(typeof boost!.amount).toBe("string");
      expect(typeof boost!.createdAt).toBe("string");
      expect(boost!.agentId).toBe(agent.id);
      expect(boost!.agentName).toBe("Fields Test Agent");
      expect(boost!.amount).toBe("250000000000000000000");
      expect(boost!.wallet).toMatch(/^0x[0-9a-f]{40}$/);
    });

    test("should handle boosts from multiple users to different agents", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { agent: agent1, user: user1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Multi User Agent 1",
        });
      const { agent: agent2, user: user2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Multi User Agent 2",
        });
      const createResponse = await createTestCompetition({
        adminClient,
        ...getBoostDates(),
        name: `Multi User Test ${Date.now()}`,
      });
      const competitionId = createResponse.competition.id;

      await startExistingTestCompetition({
        adminClient,
        competitionId,
        agentIds: [agent1.id, agent2.id],
      });

      // Create boosts directly using repository
      // User1 boosts agent2
      await createBoostDirectly(
        user1.id,
        user1.walletAddress,
        competitionId,
        agent2.id,
        300000000000000000000n,
      );

      // User2 boosts agent1
      await createBoostDirectly(
        user2.id,
        user2.walletAddress,
        competitionId,
        agent1.id,
        200000000000000000000n,
      );

      // Get all boosts
      const response = (await adminClient.getCompetitionBoosts(
        competitionId,
      )) as CompetitionBoostsResponse;

      expect(response.success).toBe(true);
      expect(response.data.items).toHaveLength(2);

      const boosts = response.data.items;

      // Find each boost
      const user1Boost = boosts.find(
        (b) => b.wallet.toLowerCase() === user1.walletAddress.toLowerCase(),
      );
      const user2Boost = boosts.find(
        (b) => b.wallet.toLowerCase() === user2.walletAddress.toLowerCase(),
      );

      expect(user1Boost).toBeDefined();
      expect(user2Boost).toBeDefined();

      // Verify cross-references
      expect(user1Boost!.agentId).toBe(agent2.id);
      expect(user2Boost!.agentId).toBe(agent1.id);

      expect(user1Boost!.agentName).toBe("Multi User Agent 2");
      expect(user2Boost!.agentName).toBe("Multi User Agent 1");
    });
  });
});
