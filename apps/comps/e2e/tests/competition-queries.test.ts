import { beforeEach, describe, expect, test } from "vitest";

import { specificChainTokens } from "@recallnet/services/lib";
import {
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionStatus,
  CreateCompetitionResponse,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
  TradeResponse,
} from "@recallnet/test-utils";
import {
  createPerpsTestCompetition,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
} from "@recallnet/test-utils";
import { wait } from "@recallnet/test-utils";

import { portfolioSnapshotterService } from "@/lib/services";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

describe("Competition API", () => {
  let adminApiKey: string;
  let rpcClient: Awaited<ReturnType<typeof createTestRpcClient>>;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
    // Create RPC client for public competition queries
    rpcClient = await createTestRpcClient();
  });

  test("anyone can view competition rules by competition ID (public endpoint)", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a competition with specific trading constraints
    const competitionName = `Public Rules Test ${Date.now()}`;
    const customConstraints = {
      minimumPairAgeHours: 96,
      minimum24hVolumeUsd: 100000,
      minimumLiquidityUsd: 200000,
      minimumFdvUsd: 3000000,
    };

    const createResponse = (await adminClient.createCompetition({
      name: competitionName,
      description: "Test competition for public rules endpoint",
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      tradingConstraints: customConstraints,
    })) as CreateCompetitionResponse;

    expect(createResponse.success).toBe(true);
    const competitionId = createResponse.competition.id;

    // Test 1: Unauthenticated client can access the rules

    const rules = await rpcClient.competitions.getRules({
      competitionId,
    });

    // Verify rules structure
    expect(rules.tradingRules).toBeDefined();
    expect(rules.tradingRules).toBeInstanceOf(Array);
    expect(rules.rateLimits).toBeDefined();
    expect(rules.availableChains).toBeDefined();
    expect(rules.slippageFormula).toBeDefined();

    // Verify trading constraints
    expect(rules.tradingConstraints).toBeDefined();
    expect(rules.tradingConstraints?.minimumPairAgeHours).toBe(96);
    expect(rules.tradingConstraints?.minimum24hVolumeUsd).toBe(100000);
    expect(rules.tradingConstraints?.minimumLiquidityUsd).toBe(200000);
    expect(rules.tradingConstraints?.minimumFdvUsd).toBe(3000000);

    // Verify trading rules include the constraints
    const tradingRules = rules.tradingRules;
    expect(
      tradingRules.some((rule: string) =>
        rule.includes("minimum 96 hours of trading history"),
      ),
    ).toBe(true);
    expect(
      tradingRules.some((rule: string) =>
        rule.includes("minimum 24h volume of $100,000 USD"),
      ),
    ).toBe(true);

    // Test 2: Returns 404 for non-existent competition
    await expect(
      rpcClient.competitions.getRules({
        competitionId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow("not found");

    // Test 3: Works for both pending and active competitions
    // Start the competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Starter Agent",
    });

    await adminClient.startExistingCompetition({
      competitionId,
      agentIds: [agent.id],
    });

    // Should still be able to get rules after competition is started
    const activeRules = await rpcClient.competitions.getRules({
      competitionId,
    });

    expect(activeRules).toBeDefined();
  });

  describe("get competitions", () => {
    test("can get list of competitions by status", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create several competitions in PENDING state
      const comp1Name = `Upcoming Competition 1 ${Date.now()}`;
      const comp2Name = `Upcoming Competition 2 ${Date.now()}`;
      const comp3Name = `Upcoming Competition 3 ${Date.now()}`;

      // Create the competitions
      const createResponse1 = (await adminClient.createCompetition({
        name: comp1Name,
        description: "Test competition 1",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      })) as CreateCompetitionResponse;
      const createResponse2 = (await adminClient.createCompetition({
        name: comp2Name,
        description: "Test competition 2",
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      })) as CreateCompetitionResponse;
      const createResponse3 = (await adminClient.createCompetition({
        name: comp3Name,
        description: "Test competition 3",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      })) as CreateCompetitionResponse;

      // Verify all competitions were created and in PENDING state
      expect(createResponse1.competition.status).toBe("pending");
      expect(createResponse2.competition.status).toBe("pending");
      expect(createResponse3.competition.status).toBe("pending");

      // Get pending competitions
      const pendingResponse = await rpcClient.competitions.list({
        status: "pending",
      });

      // Verify the response
      expect(pendingResponse.competitions).toBeDefined();
      expect(Array.isArray(pendingResponse.competitions)).toBe(true);
      expect(pendingResponse.competitions.length).toBe(3);

      // Validate pagination metadata
      expect(pendingResponse.pagination).toBeDefined();
      expect(pendingResponse.pagination.total).toBe(3); // total competitions created
      expect(pendingResponse.pagination.limit).toBe(10); // default limit
      expect(pendingResponse.pagination.offset).toBe(0); // default offset
      expect(typeof pendingResponse.pagination.hasMore).toBe("boolean");
      expect(pendingResponse.pagination.hasMore).toBe(false); // 3 competitions < 10 limit

      // Verify each competition has all expected fields
      pendingResponse.competitions.forEach((comp) => {
        expect(comp.id).toBeDefined();
        expect(comp.name).toBeDefined();
        expect(comp.status).toBe("pending");
        expect(comp.crossChainTradingType).toBeDefined();
        expect(comp.createdAt).toBeDefined();
        expect(comp.updatedAt).toBeDefined();
      });

      // Register an agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Upcoming competitions viewer test agent",
      });

      // Start one of the competitions to verify it moves from pending to active
      await startExistingTestCompetition({
        adminClient,
        competitionId: createResponse1.competition.id,
        agentIds: [agent.id],
      });

      // Get pending competitions again - should be 2 now
      const pendingResponseAfterStart = await rpcClient.competitions.list({
        status: "pending",
      });
      expect(pendingResponseAfterStart.competitions.length).toBe(2);

      // Get active competitions - should be 1 now
      const activeResponse = await rpcClient.competitions.list({
        status: "active",
      });
      expect(activeResponse.competitions.length).toBe(1);
    });

    test("rejects invalid status parameter", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition
      await adminClient.createCompetition({
        name: `Validation Test Competition ${Date.now()}`,
        description: "Test competition for validation",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      });

      // Try to get competitions with invalid status - should throw error
      await expect(
        rpcClient.competitions.list({
          status: "invalid_status" as CompetitionStatus,
        }),
      ).rejects.toThrow("Input validation failed");
    });

    test("can sort competitions by creation date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create several competitions in PENDING state that are at least 1200 ms
      // apart in creation date, since we are storing at a 1 second precision.
      const comp1Name = `Sort Test Competition 1 ${Date.now()}`;
      const comp2Name = `Sort Test Competition 2 ${Date.now()}`;
      const comp3Name = `Sort Test Competition 3 ${Date.now()}`;

      // Create the competitions
      await adminClient.createCompetition({
        name: comp1Name,
        description: "Test competition 1",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      });
      await wait(1200);
      await adminClient.createCompetition({
        name: comp2Name,
        description: "Test competition 2",
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      await wait(1200);
      await adminClient.createCompetition({
        name: comp3Name,
        description: "Test competition 3",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
      });

      // Get competitions sorted by creation date ascending
      const ascResponse = await rpcClient.competitions.list({
        status: "pending",
        paging: { sort: "createdAt" },
      });

      // Verify ascending order
      expect(ascResponse.competitions).toBeDefined();
      expect(Array.isArray(ascResponse.competitions)).toBe(true);
      expect(ascResponse.competitions[0]?.name).toBe(comp1Name);
      expect(ascResponse.competitions[1]?.name).toBe(comp2Name);
      expect(ascResponse.competitions[2]?.name).toBe(comp3Name);

      // Get competitions sorted by creation date descending (note the '-' prefix)
      const descResponse = await rpcClient.competitions.list({
        status: "pending",
        paging: { sort: "-createdAt" },
      });

      // Verify descending order
      expect(descResponse.competitions).toBeDefined();
      expect(Array.isArray(descResponse.competitions)).toBe(true);
      expect(descResponse.competitions[0]?.name).toBe(comp3Name);
      expect(descResponse.competitions[1]?.name).toBe(comp2Name);
      expect(descResponse.competitions[2]?.name).toBe(comp1Name);
    }, 1000000);

    test("should support pagination for competitions list", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create multiple competitions for pagination testing
      const competitionNames: string[] = [];
      for (let i = 0; i < 5; i++) {
        const name = `Pagination Test Competition ${i + 1} ${Date.now()}`;
        competitionNames.push(name);
        await adminClient.createCompetition({
          name: name,
          description: `Test competition ${i + 1}`,
          tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        });

        await wait(100); // Small delay to ensure different timestamps
      }

      // Test first page with limit 3
      const firstPageResponse = await rpcClient.competitions.list({
        status: "pending",
        paging: { limit: 3, offset: 0 },
      });

      expect(firstPageResponse.competitions.length).toBe(3);
      expect(firstPageResponse.pagination.total).toBe(5);
      expect(firstPageResponse.pagination.limit).toBe(3);
      expect(firstPageResponse.pagination.offset).toBe(0);
      expect(firstPageResponse.pagination.hasMore).toBe(true); // 0 + 3 < 5

      // Test second page with limit 3, offset 3
      const secondPageResponse = await rpcClient.competitions.list({
        status: "pending",
        paging: { limit: 3, offset: 3 },
      });

      expect(secondPageResponse.competitions.length).toBe(2); // remaining competitions
      expect(secondPageResponse.pagination.total).toBe(5);
      expect(secondPageResponse.pagination.limit).toBe(3);
      expect(secondPageResponse.pagination.offset).toBe(3);
      expect(secondPageResponse.pagination.hasMore).toBe(false); // 3 + 3 > 5

      // Test beyond last page
      const emptyPageResponse = await rpcClient.competitions.list({
        status: "pending",
        paging: { limit: 3, offset: 6 },
      });

      expect(emptyPageResponse.competitions.length).toBe(0);
      expect(emptyPageResponse.pagination.total).toBe(5);
      expect(emptyPageResponse.pagination.limit).toBe(3);
      expect(emptyPageResponse.pagination.offset).toBe(6);
      expect(emptyPageResponse.pagination.hasMore).toBe(false); // 6 + 3 > 5
    });
  });

  test("competitions include externalUrl and imageUrl fields", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Link and Image Test Agent",
    });

    // Test data for new fields
    const externalUrl = "https://example.com/competition-details";
    const imageUrl = "https://example.com/competition-image.jpg";

    // 1. Test creating a competition with externalUrl and imageUrl
    const createCompetitionName = `Create with Links Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: createCompetitionName,
      description: "Test description with links",
      externalUrl,
      imageUrl,
    });

    // Verify the fields are in the creation response
    expect(createResponse.success).toBe(true);
    expect(createResponse.competition.externalUrl).toBe(externalUrl);
    expect(createResponse.competition.imageUrl).toBe(imageUrl);

    // 2. Test starting a competition with externalUrl and imageUrl
    const startCompetitionName = `Start with Links Test ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: startCompetitionName,
      agentIds: [agent.id],
      externalUrl,
      imageUrl,
    });

    // Verify the fields are in the start competition response
    expect(startResponse.success).toBe(true);
    expect(startResponse.competition.externalUrl).toBe(externalUrl);
    expect(startResponse.competition.imageUrl).toBe(imageUrl);

    // 3. Verify the fields are in the competition detail response
    const competitionId = startResponse.competition.id;
    const competition = await rpcClient.competitions.getById({
      id: competitionId,
    });
    expect(competition.id).toBe(competitionId);
    expect(competition.status).toBe("active");
    expect(competition.externalUrl).toBe(externalUrl);
    expect(competition.imageUrl).toBe(imageUrl);

    // 4. Verify the fields are in the competitions list for pending competitions
    // First, end the active competition
    await adminClient.endCompetition(startResponse.competition.id);

    // Get pending competitions using RPC
    const pendingCompetitionsResponse = await rpcClient.competitions.list({
      status: "pending",
    });

    // Find our created but not started competition
    const pendingCompetition = pendingCompetitionsResponse.competitions.find(
      (comp) => comp.id === createResponse.competition.id,
    );

    expect(pendingCompetition).toBeDefined();
    expect(pendingCompetition?.externalUrl).toBe(externalUrl);
    expect(pendingCompetition?.imageUrl).toBe(imageUrl);

    // 5. Test starting an existing competition
    const startExistingResponse = await startExistingTestCompetition({
      adminClient,
      competitionId: createResponse.competition.id,
      agentIds: [agent.id],
    });

    // Verify the original fields are in the response
    expect(startExistingResponse.success).toBe(true);
    expect(startExistingResponse.competition.externalUrl).toBe(externalUrl);
    expect(startExistingResponse.competition.imageUrl).toBe(imageUrl);
  });

  describe("get competition details by ID", () => {
    test("should get competition details by ID", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition
      const competitionName = `Detail Test Competition ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
        description: "Test competition for detail endpoint",
      });

      // Get competition details by ID
      const competition = await rpcClient.competitions.getById({
        id: createResponse.competition.id,
      });

      // Verify the response
      expect(competition).toBeDefined();
      expect(competition.id).toBe(createResponse.competition.id);
      expect(competition.name).toBe(competitionName);
      expect(competition.description).toBe(
        "Test competition for detail endpoint",
      );
      expect(competition.status).toBe("pending");
      expect(competition.createdAt).toBeDefined();
      expect(competition.updatedAt).toBeDefined();
      expect(competition.endDate).toBeNull();
    });

    test("should include trading constraints in competition details by ID", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition with custom trading constraints
      const competitionName = `Trading Constraints Detail Test ${Date.now()}`;
      const customConstraints = {
        minimumPairAgeHours: 72,
        minimum24hVolumeUsd: 500000,
        minimumLiquidityUsd: 300000,
        minimumFdvUsd: 5000000,
      };

      const createResponse = (await adminClient.createCompetition({
        name: competitionName,
        description:
          "Test competition with trading constraints for detail endpoint",
        tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
        tradingConstraints: customConstraints,
      })) as CreateCompetitionResponse;

      // Get competition details
      const competition = await rpcClient.competitions.getById({
        id: createResponse.competition.id,
      });

      // Verify the response includes trading constraints
      expect(competition).toBeDefined();
      expect(competition.tradingConstraints).toBeDefined();
      expect(competition.tradingConstraints?.minimumPairAgeHours).toBe(72);
      expect(competition.tradingConstraints?.minimum24hVolumeUsd).toBe(500000);
      expect(competition.tradingConstraints?.minimumLiquidityUsd).toBe(300000);
      expect(competition.tradingConstraints?.minimumFdvUsd).toBe(5000000);
    });

    test("should throw error for non-existent competition", async () => {
      // Try to get a non-existent competition - should throw error
      await expect(
        rpcClient.competitions.getById({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("not found");
    });

    test("should include all required fields in competition details", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register an agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Fields Test Agent",
      });

      // Create and start a competition
      const competitionName = `Fields Test Competition ${Date.now()}`;
      const startResponse = await adminClient.startCompetition({
        name: competitionName,
        description: "Test competition for field validation",
        agentIds: [agent.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
        externalUrl: "https://example.com",
        imageUrl: "https://example.com/image.png",
      });

      expect(startResponse.success).toBe(true);
      const competitionId = (startResponse as StartCompetitionResponse)
        .competition.id;

      // Get competition details
      const competition = await rpcClient.competitions.getById({
        id: competitionId,
      });

      // Verify all required fields are present
      expect(competition.id).toBe(competitionId);
      expect(competition.name).toBe(competitionName);
      expect(competition.description).toBe(
        "Test competition for field validation",
      );
      expect(competition.status).toBe("active");
      expect(competition.externalUrl).toBe("https://example.com");
      expect(competition.imageUrl).toBe("https://example.com/image.png");
      expect(competition.createdAt).toBeDefined();
      expect(competition.updatedAt).toBeDefined();
      expect(competition.startDate).toBeDefined();
      expect(competition.endDate).toBeNull();
    });

    test("should include arena and participation fields in competition details", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create arena
      const arenaId = `test-arena-${Date.now()}`;
      await adminClient.createArena({
        id: arenaId,
        name: "Test Arena",
        createdBy: "admin",
        category: "crypto_trading",
        skill: "spot_paper_trading",
      });

      // Create competition with all new fields
      const competitionName = `Arena Fields Test ${Date.now()}`;
      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test arena and participation fields",
        type: "trading",
        arenaId: arenaId,
        engineId: "spot_paper_trading",
        engineVersion: "1.0.0",
        vips: ["vip-agent-1", "vip-agent-2"],
        allowlist: ["allowed-1"],
        blocklist: ["blocked-1"],
        minRecallRank: 100,
        allowlistOnly: true,
        agentAllocation: 10000,
        agentAllocationUnit: "RECALL",
        boosterAllocation: 5000,
        boosterAllocationUnit: "USDC",
        rewardRules: "Top 10 winners",
        rewardDetails: "Distributed weekly",
        displayState: "active",
      });

      expect(createResponse.success).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Get competition details
      const competition = await rpcClient.competitions.getById({
        id: competitionId,
      });

      // Verify arena and engine fields
      expect(competition.arenaId).toBe(arenaId);
      expect(competition.engineId).toBe("spot_paper_trading");
      expect(competition.engineVersion).toBe("1.0.0");

      // Verify participation fields
      expect(competition.vips).toEqual(["vip-agent-1", "vip-agent-2"]);
      expect(competition.allowlist).toEqual(["allowed-1"]);
      expect(competition.blocklist).toEqual(["blocked-1"]);
      expect(competition.minRecallRank).toBe(100);
      expect(competition.allowlistOnly).toBe(true);

      // Verify reward allocation fields
      expect(competition.agentAllocation).toBe(10000);
      expect(competition.agentAllocationUnit).toBe("RECALL");
      expect(competition.boosterAllocation).toBe(5000);
      expect(competition.boosterAllocationUnit).toBe("USDC");
      expect(competition.rewardRules).toBe("Top 10 winners");
      expect(competition.rewardDetails).toBe("Distributed weekly");

      // Verify display state
      expect(competition.displayState).toBe("active");
    });

    test("should return arena and participation fields when competition is modified", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create basic competition
      const createResponse = await adminClient.createCompetition({
        name: "Basic Competition",
        type: "trading",
      });
      expect(createResponse.success).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Create arena for linking
      const arenaId = `modify-test-arena-${Date.now()}`;
      await adminClient.createArena({
        id: arenaId,
        name: "Modify Test Arena",
        createdBy: "admin",
        category: "crypto_trading",
        skill: "spot_paper_trading",
      });

      // Modify competition to add arena and participation fields
      await adminClient.updateCompetition(competitionId, {
        arenaId: arenaId,
        engineId: "spot_paper_trading",
        engineVersion: "2.0.0",
        vips: ["vip-agent"],
        allowlist: ["allowed-agent"],
        minRecallRank: 200,
        agentAllocation: 20000,
        agentAllocationUnit: "USDC",
        displayState: "waitlist",
      });

      // Fetch competition and verify fields are returned
      const competition = await rpcClient.competitions.getById({
        id: competitionId,
      });

      // Verify fields are in the response
      expect(competition.arenaId).toBe(arenaId);
      expect(competition.engineId).toBe("spot_paper_trading");
      expect(competition.engineVersion).toBe("2.0.0");
      expect(competition.vips).toEqual(["vip-agent"]);
      expect(competition.allowlist).toEqual(["allowed-agent"]);
      expect(competition.minRecallRank).toBe(200);
      expect(competition.agentAllocation).toBe(20000);
      expect(competition.agentAllocationUnit).toBe("USDC");
      expect(competition.displayState).toBe("waitlist");
    });
  });

  describe("get competition agents", () => {
    test("should get competition agents with scores and ranks", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register multiple agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent One",
      });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Two",
      });

      // Create and start a competition with multiple agents
      const competitionName = `Agents Test Competition ${Date.now()}`;
      const startResponse = await adminClient.startCompetition({
        name: competitionName,
        description: "Test competition for agents endpoint",
        agentIds: [agent1.id, agent2.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });

      expect(startResponse.success).toBe(true);
      const competition = (startResponse as StartCompetitionResponse)
        .competition;

      // Get competition agents
      const agentsData = await rpcClient.competitions.getAgents({
        competitionId: competition.id,
      });

      expect(agentsData.agents).toHaveLength(2);

      // Verify agent data structure
      for (const agent of agentsData.agents) {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(typeof agent.score).toBe("number");
        expect(typeof agent.rank).toBe("number");
        expect(typeof agent.portfolioValue).toBe("number");
        expect(typeof agent.active).toBe("boolean");
        expect(agent.deactivationReason).toBeNull();

        // Verify new PnL and 24h change fields are accessible to Privy users
        expect(typeof agent.pnl).toBe("number");
        expect(typeof agent.pnlPercent).toBe("number");
        expect(typeof agent.change24h).toBe("number");
        expect(typeof agent.change24hPercent).toBe("number");

        // Values should be finite (not NaN or Infinity)
        expect(Number.isFinite(agent.pnl)).toBe(true);
        expect(Number.isFinite(agent.pnlPercent)).toBe(true);
        expect(Number.isFinite(agent.change24h)).toBe(true);
        expect(Number.isFinite(agent.change24hPercent)).toBe(true);
      }

      // Verify agents are ordered by rank
      const ranks = agentsData.agents.map((a) => a.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => (a ?? 0) - (b ?? 0)));
    });

    test("should return 404 for agents of non-existent competition", async () => {
      // Try to get agents for a non-existent competition
      await expect(
        rpcClient.competitions.getAgents({
          competitionId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow(/not found/i);
    });

    test("should handle competitions with no agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition without starting it (no agents)
      const competitionName = `Empty Competition ${Date.now()}`;
      const createResponse = await createTestCompetition({
        adminClient,
        name: competitionName,
      });

      // Test getting agents for competition with no agents
      const agentsResponse = await rpcClient.competitions.getAgents({
        competitionId: createResponse.competition.id,
      });

      // Verify the response
      expect(agentsResponse.agents).toBeDefined();
      expect(Array.isArray(agentsResponse.agents)).toBe(true);
      expect(agentsResponse.agents.length).toBe(0);
    });

    test("should calculate PnL and 24h change fields correctly", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register multiple agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "PnL Test Agent 1",
      });

      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "PnL Test Agent 2",
      });

      // Start a competition with both agents
      const competitionName = `PnL Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent1.id, agent2.id],
      });
      const competitionId = startResult.competition.id;

      // Wait a moment for initial snapshots to be taken
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get competition agents
      const response = await rpcClient.competitions.getAgents({
        competitionId,
      });

      expect(response.agents).toBeDefined();
      expect(response.agents.length).toBe(2);

      // Verify all agents have PnL and 24h change fields
      for (const agentData of response.agents) {
        expect(agentData).toBeDefined();
        expect(typeof agentData.pnl).toBe("number");
        expect(typeof agentData.pnlPercent).toBe("number");
        expect(typeof agentData.change24h).toBe("number");
        expect(typeof agentData.change24hPercent).toBe("number");

        // For a new competition, PnL should be 0 or very small (since no trading has occurred)
        expect(Math.abs(agentData.pnl)).toBeLessThan(1); // Less than $1 difference
        expect(Math.abs(agentData.pnlPercent)).toBeLessThan(1); // Less than 1% difference

        // 24h change should also be 0 or very small for a new competition
        expect(Math.abs(agentData.change24h)).toBeLessThan(1);
        expect(Math.abs(agentData.change24hPercent)).toBeLessThan(1);

        // Portfolio value should be positive (agents start with initial balances)
        expect(agentData.portfolioValue).toBeGreaterThan(0);
        expect(agentData.score).toBe(agentData.portfolioValue); // Score should equal portfolio value
      }
    });

    test("should calculate stats in competition details", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register multiple agents
      const { agent: agent1, client: client1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "PnL Test Agent 1",
        });

      const { agent: agent2, client: client2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "PnL Test Agent 2",
        });

      // Start a competition with both agents
      const competitionName = `PnL Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent1.id, agent2.id],
      });
      const competitionId = startResult.competition.id;
      await wait(100);
      // Make trades with both clients
      const trades1 = await client1.executeTrade({
        fromToken: specificChainTokens.eth.eth,
        toToken: specificChainTokens.eth.usdc,
        amount: "0.001",
        competitionId,
        reason: "Test trade 1",
      });
      expect(trades1.success).toBe(true);
      const trades2 = await client1.executeTrade({
        fromToken: specificChainTokens.eth.eth,
        toToken: specificChainTokens.eth.usdt,
        amount: "0.001",
        competitionId,
        reason: "Test trade 2",
      });
      expect(trades2.success).toBe(true);
      const trades3 = await client2.executeTrade({
        fromToken: specificChainTokens.eth.eth,
        toToken: specificChainTokens.eth.usdt,
        amount: "0.001",
        competitionId,
        reason: "Test trade 3",
      });
      expect(trades3.success).toBe(true);
      const trades4 = await client2.executeTrade({
        fromToken: specificChainTokens.eth.eth,
        toToken: specificChainTokens.eth.usdc,
        amount: "0.001",
        competitionId,
        reason: "Test trade 4",
      });
      expect(trades4.success).toBe(true);

      // Get the total trade values
      const allTrades = [trades1, trades2, trades3, trades4] as TradeResponse[];
      const totalVolume = allTrades.reduce(
        (acc, trade) => acc + (trade.transaction.tradeAmountUsd ?? 0),
        0,
      );

      const competition = await rpcClient.competitions.getById({
        id: competitionId,
      });

      const stats = competition.stats;
      expect(stats).toBeDefined();
      expect(stats?.totalTrades).toBe(4);
      expect(stats?.totalAgents).toBe(2);
      expect(stats?.totalVolume).toBe(totalVolume);
      expect(stats?.uniqueTokens).toBe(3);
    });

    test("should handle edge cases for PnL calculations", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Edge Case Test Agent",
      });

      // Start a competition
      const competitionName = `Edge Case Test ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent.id],
      });
      const competitionId = startResult.competition.id;

      // Get competition agents immediately (before snapshots might be taken)
      const response = await rpcClient.competitions.getAgents({
        competitionId,
      });

      expect(response.agents.length).toBe(1);

      const agentData = response.agents[0]!;

      // Even with minimal or no snapshot history, fields should be present and numeric
      expect(typeof agentData.pnl).toBe("number");
      expect(typeof agentData.pnlPercent).toBe("number");
      expect(typeof agentData.change24h).toBe("number");
      expect(typeof agentData.change24hPercent).toBe("number");

      // Values should be finite (not NaN or Infinity)
      expect(Number.isFinite(agentData.pnl)).toBe(true);
      expect(Number.isFinite(agentData.pnlPercent)).toBe(true);
      expect(Number.isFinite(agentData.change24h)).toBe(true);
      expect(Number.isFinite(agentData.change24hPercent)).toBe(true);
    });

    test("should order pending competition leaderboards by global scores based on competition type", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { client: agentClient1, agent: agent1 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Type Test Agent 1",
        });
      const { client: agentClient2, agent: agent2 } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Type Test Agent 2",
        });
      const { agent: agent3 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Type Test Agent 3",
      });
      const { agent: agent4 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Type Test Agent 4",
      });

      // ===== Step 1: Create and complete a TRADING competition with agents 1 & 2 =====
      const tradingComp1 = await adminClient.createCompetition({
        name: `Trading Type Test ${Date.now()}`,
        description: "Trading competition to establish global scores",
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
        type: "trading",
      });
      expect(tradingComp1.success).toBe(true);
      const tradingCompId1 = (tradingComp1 as CreateCompetitionResponse)
        .competition.id;

      // Only agents 1 and 2 compete in trading
      await adminClient.startExistingCompetition({
        competitionId: tradingCompId1,
        agentIds: [agent1.id, agent2.id],
      });
      // Make trades - agent2 wins, agent1 loses
      await agentClient1.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "100",
        competitionId: tradingCompId1,
        reason: "Agent1 loses trading comp",
      });
      await agentClient2.executeTrade({
        fromToken: specificChainTokens.eth.usdc,
        toToken: "0x000000000000000000000000000000000000dead",
        amount: "10",
        competitionId: tradingCompId1,
        reason: "Agent2 wins trading comp",
      });

      // Check global leaderboard after first competition
      await adminClient.endCompetition(tradingCompId1);
      const globalAfterTrading =
        (await agentClient1.getGlobalLeaderboard()) as GlobalLeaderboardResponse;
      expect(globalAfterTrading.success).toBe(true);
      expect(globalAfterTrading.agents.length).toBe(2);
      expect(globalAfterTrading.agents[0]?.id).toBe(agent2.id);
      expect(globalAfterTrading.agents[1]?.id).toBe(agent1.id);

      // ===== Step 2: Create and complete a PERPS competition with agents 3 & 4 agents =====
      const perpsComp = await createPerpsTestCompetition({
        adminClient,
        name: `Perps Type Test ${Date.now()}`,
        description:
          "Perps competition with all agents for type segregation test",
        perpsProvider: {
          provider: "symphony",
          initialCapital: 500,
          selfFundingThreshold: 0,
          apiUrl: "http://localhost:4567",
        },
      });
      expect(perpsComp.success).toBe(true);
      const perpsCompId = (perpsComp as CreateCompetitionResponse).competition
        .id;
      await adminClient.startExistingCompetition({
        competitionId: perpsCompId,
        agentIds: [agent3.id, agent4.id],
      });

      // ===== Step 3: Create PENDING competitions of each type =====

      // Create a PENDING trading competition with agent 1 and 3
      const pendingTradingComp = await adminClient.createCompetition({
        name: `Pending Trading Type Test ${Date.now()}`,
        description: "Pending trading competition to test leaderboard ordering",
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
        type: "trading",
      });
      expect(pendingTradingComp.success).toBe(true);
      const pendingTradingCompId = (
        pendingTradingComp as CreateCompetitionResponse
      ).competition.id;

      // Create a PENDING perps competition with agent 2 and 4
      const pendingPerpsComp = await createPerpsTestCompetition({
        adminClient,
        name: `Pending Perps Type Test ${Date.now()}`,
        description: "Pending perps competition to test leaderboard ordering",
        perpsProvider: {
          provider: "symphony",
          initialCapital: 500,
          selfFundingThreshold: 0,
          apiUrl: "http://localhost:4567",
        },
      });
      expect(pendingPerpsComp.success).toBe(true);
      const pendingPerpsCompId = (pendingPerpsComp as CreateCompetitionResponse)
        .competition.id;

      // Add agents 1 & 3 to trading, and 2 & 4 to perps. Each comp has one agent that
      // has a global rank, and one that doesn't
      await adminClient.addAgentToCompetition(pendingTradingCompId, agent1.id);
      await adminClient.addAgentToCompetition(pendingTradingCompId, agent3.id);
      await adminClient.addAgentToCompetition(pendingPerpsCompId, agent2.id);
      await adminClient.addAgentToCompetition(pendingPerpsCompId, agent4.id);

      // ===== Step 4: Verify pending competitions use type-specific global scores =====

      const pendingTradingAgentsResponse =
        await rpcClient.competitions.getAgents({
          competitionId: pendingTradingCompId,
        });
      const pendingTradingAgents = pendingTradingAgentsResponse.agents;
      const agent1Trading = pendingTradingAgents.find(
        (a) => a.id === agent1.id,
      );
      const agent3Trading = pendingTradingAgents.find(
        (a) => a.id === agent3.id,
      );
      expect(agent1Trading!.rank).toBe(1);
      expect(agent3Trading!.rank).toBe(2);

      const pendingPerpsAgentsResponse = await rpcClient.competitions.getAgents(
        {
          competitionId: pendingPerpsCompId,
        },
      );
      const pendingPerpsAgents = pendingPerpsAgentsResponse.agents;
      const agent2Perps = pendingPerpsAgents.find((a) => a.id === agent2.id);
      const agent4Perps = pendingPerpsAgents.find((a) => a.id === agent4.id);
      expect(agent2Perps!.rank).toBe(1);
      expect(agent4Perps!.rank).toBe(2);
    });

    test("should support pagination for competition agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register multiple agents for pagination testing
      const agents = [];
      for (let i = 1; i <= 5; i++) {
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Pagination Test Agent ${i}`,
        });
        agents.push(agent);
      }

      // Start a competition with all agents
      const competitionName = `Pagination Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: agents.map((a) => a.id),
      });
      const competitionId = startResult.competition.id;

      // Test pagination with limit=2, offset=0
      const page1Response = await rpcClient.competitions.getAgents({
        competitionId,
        paging: { limit: 2, offset: 0 },
      });

      expect(page1Response.agents.length).toBe(2);
      expect(page1Response.pagination.total).toBe(5);
      expect(page1Response.pagination.limit).toBe(2);
      expect(page1Response.pagination.offset).toBe(0);
      expect(page1Response.pagination.hasMore).toBe(true);

      // Test pagination with limit=2, offset=2
      const page2Response = await rpcClient.competitions.getAgents({
        competitionId,
        paging: { limit: 2, offset: 2 },
      });

      expect(page2Response.agents.length).toBe(2);
      expect(page2Response.pagination.total).toBe(5);
      expect(page2Response.pagination.limit).toBe(2);
      expect(page2Response.pagination.offset).toBe(2);
      expect(page2Response.pagination.hasMore).toBe(true);

      // Test pagination with limit=2, offset=4 (last page)
      const page3Response = await rpcClient.competitions.getAgents({
        competitionId,
        paging: { limit: 2, offset: 4 },
      });

      expect(page3Response.agents.length).toBe(1);
      expect(page3Response.pagination.total).toBe(5);
      expect(page3Response.pagination.limit).toBe(2);
      expect(page3Response.pagination.offset).toBe(4);
      expect(page3Response.pagination.hasMore).toBe(false);

      // Verify no duplicate agents across pages
      const allAgentIds = [
        ...page1Response.agents.map((a) => a.id),
        ...page2Response.agents.map((a) => a.id),
        ...page3Response.agents.map((a) => a.id),
      ];
      const uniqueAgentIds = new Set(allAgentIds);
      expect(uniqueAgentIds.size).toBe(5);
    });

    test("should support filtering competition agents by name", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents with specific names for filtering
      const { agent: alphaAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Alpha Filter Agent",
      });
      const { agent: betaAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Beta Filter Agent",
      });
      const { agent: gammaAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Gamma Different Agent",
      });

      // Start a competition with all agents
      const competitionName = `Filter Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [alphaAgent.id, betaAgent.id, gammaAgent.id],
      });
      const competitionId = startResult.competition.id;

      // Test filtering by "Filter" - should return Alpha and Beta agents
      const filterResponse = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "Filter",
      });

      expect(filterResponse.agents.length).toBe(2);
      expect(filterResponse.pagination.total).toBe(2);

      const filteredNames = filterResponse.agents.map((a) => a.name);
      expect(filteredNames).toContain("Alpha Filter Agent");
      expect(filteredNames).toContain("Beta Filter Agent");
      expect(filteredNames).not.toContain("Gamma Different Agent");

      // Test filtering by "Alpha" - should return only Alpha agent
      const alphaResponse = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "Alpha",
      });

      expect(alphaResponse.agents.length).toBe(1);
      expect(alphaResponse.agents[0]?.name).toBe("Alpha Filter Agent");

      // Test filtering by non-existent term
      const noMatchResponse = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "NonExistent",
      });

      expect(noMatchResponse.agents.length).toBe(0);
      expect(noMatchResponse.pagination.total).toBe(0);
    });

    test("should support sorting competition agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents with names that will test sorting
      const { agent: charlieAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Charlie Sort Agent",
      });

      // Wait to ensure different creation times
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { agent: alphaAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Alpha Sort Agent",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const { agent: betaAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Beta Sort Agent",
      });

      // Start a competition with all agents
      const competitionName = `Sort Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [charlieAgent.id, alphaAgent.id, betaAgent.id],
      });
      const competitionId = startResult.competition.id;

      // Force a snapshot directly
      await portfolioSnapshotterService.takePortfolioSnapshots(competitionId);

      // Test sorting by default (rank)
      const rankDefaultResponse = await rpcClient.competitions.getAgents({
        competitionId,
      });

      expect(rankDefaultResponse.agents[0]!.rank).toBe(1);
      expect(rankDefaultResponse.agents[1]!.rank).toBe(2);
      expect(rankDefaultResponse.agents[2]!.rank).toBe(3);

      // Test sorting by name (ascending)
      const nameAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "name",
      });

      expect(nameAscResponse.agents.length).toBe(3);

      const nameAscOrder = nameAscResponse.agents.map((a) => a.name);
      expect(nameAscOrder[0]).toBe("Alpha Sort Agent");
      expect(nameAscOrder[1]).toBe("Beta Sort Agent");
      expect(nameAscOrder[2]).toBe("Charlie Sort Agent");

      // Test sorting by name (descending)
      const nameDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-name",
      });

      expect(nameDescResponse.agents.length).toBe(3);

      const nameDescOrder = nameDescResponse.agents.map((a) => a.name);
      expect(nameDescOrder[0]).toBe("Charlie Sort Agent");
      expect(nameDescOrder[1]).toBe("Beta Sort Agent");
      expect(nameDescOrder[2]).toBe("Alpha Sort Agent");

      // Test sorting by rank
      const rankAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "rank",
      });

      expect(rankAscResponse.agents[0]!.rank).toBe(1);
      expect(rankAscResponse.agents[1]!.rank).toBe(2);
      expect(rankAscResponse.agents[2]!.rank).toBe(3);

      // Test sorting by rank (descending)
      const rankDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-rank",
      });
      expect(rankDescResponse.agents[0]!.rank).toBe(3);
      expect(rankDescResponse.agents[1]!.rank).toBe(2);
      expect(rankDescResponse.agents[2]!.rank).toBe(1);

      // Test sorting by score (ascending)
      const scoreAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "score",
      });
      expect(scoreAscResponse.agents[0]!.score ?? 0).toBeLessThanOrEqual(
        scoreAscResponse.agents[1]!.score ?? 0,
      );
      expect(scoreAscResponse.agents[1]!.score ?? 0).toBeLessThanOrEqual(
        scoreAscResponse.agents[2]!.score ?? 0,
      );

      // Test sorting by score (descending)
      const scoreDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-score",
      });
      expect(scoreDescResponse.agents[0]!.score ?? 0).toBeGreaterThanOrEqual(
        scoreDescResponse.agents[1]!.score ?? 0,
      );
      expect(scoreDescResponse.agents[1]!.score ?? 0).toBeGreaterThanOrEqual(
        scoreDescResponse.agents[2]!.score ?? 0,
      );

      // Test sorting by portfolioValue (ascending)
      const portfolioValueAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "portfolioValue",
      });
      expect(
        portfolioValueAscResponse.agents[0]!.portfolioValue,
      ).toBeLessThanOrEqual(
        portfolioValueAscResponse.agents[1]!.portfolioValue,
      );
      expect(
        portfolioValueAscResponse.agents[1]!.portfolioValue,
      ).toBeLessThanOrEqual(
        portfolioValueAscResponse.agents[2]!.portfolioValue,
      );

      // Test sorting by portfolioValue (descending)
      const portfolioValueDescResponse = await rpcClient.competitions.getAgents(
        {
          competitionId,
          sort: "-portfolioValue",
        },
      );
      expect(
        portfolioValueDescResponse.agents[0]!.portfolioValue,
      ).toBeGreaterThanOrEqual(
        portfolioValueDescResponse.agents[1]!.portfolioValue,
      );
      expect(
        portfolioValueDescResponse.agents[1]!.portfolioValue,
      ).toBeGreaterThanOrEqual(
        portfolioValueDescResponse.agents[2]!.portfolioValue,
      );

      // Check PnL (ascending)
      const pnlAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "pnl",
      });
      expect(pnlAscResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
        pnlAscResponse.agents[1]!.pnl,
      );
      expect(pnlAscResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
        pnlAscResponse.agents[2]!.pnl,
      );

      // Check PnL (descending)
      const pnlDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-pnl",
      });
      expect(pnlDescResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
        pnlDescResponse.agents[1]!.pnl,
      );
      expect(pnlDescResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
        pnlDescResponse.agents[2]!.pnl,
      );

      // Verify PnL percentage is in ascending order
      const pnlPercentAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "pnlPercent",
      });
      expect(
        pnlPercentAscResponse.agents[0]!.pnlPercent,
      ).toBeGreaterThanOrEqual(pnlPercentAscResponse.agents[1]!.pnlPercent);
      expect(
        pnlPercentAscResponse.agents[1]!.pnlPercent,
      ).toBeGreaterThanOrEqual(pnlPercentAscResponse.agents[2]!.pnlPercent);

      // Verify PnL percentage is in descending order
      const pnlPercentDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-pnlPercent",
      });
      expect(pnlPercentDescResponse.agents[0]!.pnlPercent).toBeLessThanOrEqual(
        pnlPercentDescResponse.agents[1]!.pnlPercent,
      );
      expect(pnlPercentDescResponse.agents[1]!.pnlPercent).toBeLessThanOrEqual(
        pnlPercentDescResponse.agents[2]!.pnlPercent,
      );

      // Verify change24h is in ascending order
      const change24hAscResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "change24h",
      });
      expect(change24hAscResponse.agents[0]!.change24h).toBeGreaterThanOrEqual(
        change24hAscResponse.agents[1]!.change24h,
      );
      expect(change24hAscResponse.agents[1]!.change24h).toBeGreaterThanOrEqual(
        change24hAscResponse.agents[2]!.change24h,
      );

      // Verify change24h is in descending order
      const change24hDescResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "-change24h",
      });
      expect(change24hDescResponse.agents[0]!.change24h).toBeLessThanOrEqual(
        change24hDescResponse.agents[1]!.change24h,
      );
      expect(change24hDescResponse.agents[1]!.change24h).toBeLessThanOrEqual(
        change24hDescResponse.agents[2]!.change24h,
      );

      // Verify change24h percentage is in ascending order
      const change24hPercentAscResponse =
        await rpcClient.competitions.getAgents({
          competitionId,
          sort: "change24hPercent",
        });
      expect(
        change24hPercentAscResponse.agents[0]!.change24hPercent,
      ).toBeGreaterThanOrEqual(
        change24hPercentAscResponse.agents[1]!.change24hPercent,
      );
      expect(
        change24hPercentAscResponse.agents[1]!.change24hPercent,
      ).toBeGreaterThanOrEqual(
        change24hPercentAscResponse.agents[2]!.change24hPercent,
      );

      // Verify change24h percentage is in descending order
      const change24hPercentDescResponse =
        await rpcClient.competitions.getAgents({
          competitionId,
          sort: "-change24hPercent",
        });
      expect(
        change24hPercentDescResponse.agents[0]!.change24hPercent,
      ).toBeLessThanOrEqual(
        change24hPercentDescResponse.agents[1]!.change24hPercent,
      );
      expect(
        change24hPercentDescResponse.agents[1]!.change24hPercent,
      ).toBeLessThanOrEqual(
        change24hPercentDescResponse.agents[2]!.change24hPercent,
      );
    });

    test("should handle computed sorting with pagination limits", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register 6 agents to test pagination
      const agents = [];
      for (let i = 1; i <= 6; i++) {
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Pagination Test Agent ${i}`,
        });
        agents.push(agent);
      }

      // Start a competition with all agents
      const competitionName = `Pagination Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: agents.map((a) => a.id),
      });
      const competitionId = startResult.competition.id;

      // Test 1: Database sorting
      const dbSortResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "name", // Database field (no computed fields)
        paging: { limit: 3, offset: 0 },
      });

      expect(dbSortResponse.agents.length).toBe(3);
      expect(dbSortResponse.pagination.limit).toBe(3);
      expect(dbSortResponse.pagination.offset).toBe(0);
      expect(dbSortResponse.pagination.total).toBe(6);
      expect(dbSortResponse.pagination.hasMore).toBe(true);

      // Test 2: Computed sorting
      const computedSortResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "rank", // Computed field
        paging: { limit: 3, offset: 0 },
      });

      expect(computedSortResponse.agents.length).toBe(3);
      expect(computedSortResponse.pagination.limit).toBe(3);
      expect(computedSortResponse.pagination.offset).toBe(0);
      expect(computedSortResponse.pagination.total).toBe(6);
      expect(computedSortResponse.pagination.hasMore).toBe(true);

      // Test 3: Try different computed fields to confirm the bug affects all computed sorting
      const testFields = [
        "score",
        "pnl",
        "pnlPercent",
        "change24h",
        "change24hPercent",
      ];

      for (const field of testFields) {
        const response = await rpcClient.competitions.getAgents({
          competitionId,
          sort: field,
          paging: { limit: 2, offset: 0 },
        });

        expect(response.agents.length).toBe(2);
        expect(response.pagination.limit).toBe(2);
      }

      // Test 4: Demonstrate that offset is also ignored
      const offsetResponse = await rpcClient.competitions.getAgents({
        competitionId,
        sort: "rank",
        paging: { limit: 2, offset: 3 },
      });

      expect(offsetResponse.agents.length).toBe(2);
      expect(offsetResponse.pagination.offset).toBe(3);
      expect(offsetResponse.pagination.limit).toBe(2);
    });

    test("should combine filtering, sorting, and pagination", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register multiple agents with "Test" in their names
      const agents = [];
      for (let i = 1; i <= 4; i++) {
        const { agent } = await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: `Test Agent ${String.fromCharCode(65 + i)}`, // Test Agent B, C, D, E
        });
        agents.push(agent);
      }

      // Register one agent without "Test" in the name
      const { agent: otherAgent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Different Agent",
      });

      // Start a competition with all agents
      const competitionName = `Combined Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [...agents.map((a) => a.id), otherAgent.id],
      });
      const competitionId = startResult.competition.id;

      // Test filtering by "Test", sorting by name, with pagination
      const response = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "Test",
        sort: "name",
        paging: { limit: 2, offset: 0 },
      });

      expect(response.agents.length).toBe(2);
      expect(response.pagination.total).toBe(4); // Only "Test" agents
      expect(response.pagination.limit).toBe(2);
      expect(response.pagination.offset).toBe(0);
      expect(response.pagination.hasMore).toBe(true);

      // Verify filtering worked (no "Different Agent")
      const agentNames = response.agents.map((a) => a.name);
      expect(agentNames.every((name) => name.includes("Test"))).toBe(true);

      // Verify sorting worked (alphabetical order)
      expect(agentNames[0]?.localeCompare(agentNames[1] || "")).toBeLessThan(0);

      // Test second page
      const page2Response = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "Test",
        sort: "name",
        paging: { limit: 2, offset: 2 },
      });

      expect(page2Response.agents.length).toBe(2);
      expect(page2Response.pagination.total).toBe(4);
      expect(page2Response.pagination.hasMore).toBe(false);
    });

    test("should validate query parameters for competition agents", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register an agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Validation Test Agent",
      });

      // Start a competition
      const competitionName = `Validation Test Competition ${Date.now()}`;
      const startResult = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [agent.id],
      });
      const competitionId = startResult.competition.id;

      // Test invalid limit (too high)
      await expect(
        rpcClient.competitions.getAgents({
          competitionId,
          paging: { limit: 150 }, // Max is 100
        }),
      ).rejects.toThrow();

      // Test invalid limit (too low)
      await expect(
        rpcClient.competitions.getAgents({
          competitionId,
          paging: { limit: 0 }, // Min is 1
        }),
      ).rejects.toThrow();

      // Test invalid offset (negative)
      await expect(
        rpcClient.competitions.getAgents({
          competitionId,
          paging: { offset: -1 }, // Min is 0
        }),
      ).rejects.toThrow();

      // Test valid parameters should work
      const validResponse = await rpcClient.competitions.getAgents({
        competitionId,
        filter: "Test",
        sort: "name",
        paging: { limit: 50, offset: 0 },
      });

      expect(validResponse.agents).toBeDefined();
    });
  });

  // Basic sanity check to verify that the API client can access all competition query endpoints
  test("API client can access all competition query endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "API Sanity Check Agent",
      });

    // Create and start a competition
    const startResult = await startTestCompetition({
      adminClient,
      name: `API Sanity Check Competition ${Date.now()}`,
      agentIds: [agent.id],
    });
    const competitionId = startResult.competition.id;

    // Test 1: getCompetition - verify API client can get competition details
    const detailResponse = await agentClient.getCompetition(competitionId);
    expect(detailResponse.success).toBe(true);
    if (detailResponse.success) {
      expect(detailResponse.competition.id).toBe(competitionId);
      expect(detailResponse.competition.status).toBe("active");
    }

    // Test 2: getCompetitionAgents - verify API client can get competition agents
    const agentsResponse =
      await agentClient.getCompetitionAgents(competitionId);
    expect(agentsResponse.success).toBe(true);
    if (agentsResponse.success) {
      expect(agentsResponse.agents).toBeDefined();
      expect(Array.isArray(agentsResponse.agents)).toBe(true);
      expect(agentsResponse.agents.length).toBeGreaterThan(0);
    }

    // Test 3: getRules - verify API client can get competition rules
    const rulesResponse = await agentClient.getRules(competitionId);
    expect(rulesResponse.success).toBe(true);
    if (rulesResponse.success) {
      expect(rulesResponse.rules).toBeDefined();
      expect(rulesResponse.rules.tradingRules).toBeDefined();
    }

    // Test 4: getCompetitions - verify API client can list competitions
    const listResponse = await agentClient.getCompetitions("active");
    expect(listResponse.success).toBe(true);
    if (listResponse.success) {
      expect(listResponse.competitions).toBeDefined();
      expect(Array.isArray(listResponse.competitions)).toBe(true);
      // Should find our competition in the list
      const foundCompetition = listResponse.competitions.find(
        (comp) => comp.id === competitionId,
      );
      expect(foundCompetition).toBeDefined();
    }
  });
});
