import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { specificChainTokens } from "@recallnet/services/lib";
import {
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CompetitionRulesResponse,
  CreateCompetitionResponse,
  ErrorResponse,
  GlobalLeaderboardResponse,
  StartCompetitionResponse,
  TradeResponse,
  UpcomingCompetitionsResponse,
} from "@recallnet/test-utils";
import { getBaseUrl } from "@recallnet/test-utils";
import {
  createPerpsTestCompetition,
  createPrivyAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startExistingTestCompetition,
  startTestCompetition,
  strictTradingConstraints,
} from "@recallnet/test-utils";
import { wait } from "@recallnet/test-utils";

import { portfolioSnapshotterService } from "@/lib/services";

describe("Competition API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("agents can view competition status and leaderboard", async () => {
    // Setup admin client and register an agent
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Gamma",
      });

    // Admin starts a competition with the agent
    const competitionName = `Viewable Competition ${Date.now()}`;
    const startedCompetition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startedCompetition.competition.id;

    // Agent checks competition status
    const competitionResponse = await agentClient.getCompetition(competitionId);
    if (!competitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const competition = competitionResponse.competition;
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("active");

    // Agent checks leaderboard
    const leaderboardResponse = await agentClient.getCompetitionAgents(
      competition.id,
      { sort: "rank" },
    );
    expect(leaderboardResponse.success).toBe(true);
    if (!leaderboardResponse.success) throw new Error("Failed to get agents");

    expect(leaderboardResponse.agents).toBeDefined();
    expect(leaderboardResponse.agents).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(leaderboardResponse.agents.length).toBe(1);

    // The agent should be in the leaderboard
    const agentInLeaderboard = leaderboardResponse.agents.find(
      (entry) => entry.name === "Agent Gamma",
    );
    expect(agentInLeaderboard).toBeDefined();
  });

  test("agents receive basic information for competitions they are not part of", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents - one in the competition, one not
    const { client: agentInClient, agent: agentIn } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Inside Agent",
      });
    const { client: agentOutClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Outside Agent",
    });

    // Start a competition with only one agent
    const { competition } = await startTestCompetition({
      adminClient,
      name: `Exclusive Competition ${Date.now()}`,
      agentIds: [agentIn.id],
    });

    // Both agents can check status of the competition by ID
    const competitionFromAgentInResponse = await agentInClient.getCompetition(
      competition.id,
    );
    if (!competitionFromAgentInResponse.success) {
      throw new Error("Failed to get competition");
    }
    const competitionFromAgentIn = competitionFromAgentInResponse.competition;
    expect(competitionFromAgentIn.id).toBe(competition.id);
    expect(competitionFromAgentIn.status).toBe("active");

    const competitionFromAgentOutResponse = await agentOutClient.getCompetition(
      competition.id,
    );
    if (!competitionFromAgentOutResponse.success) {
      throw new Error("Failed to get competition");
    }
    const competitionFromAgentOut = competitionFromAgentOutResponse.competition;
    expect(competitionFromAgentOut.id).toBe(competition.id);
    expect(competitionFromAgentOut.status).toBe("active");
  });

  test("admin can access competition status without being a participant", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a regular agent
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Regular Agent",
      });

    // Start a competition with only the regular agent (admin is not a participant)
    const competitionName = `Admin Access Test Competition ${Date.now()}`;
    const startedComp = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startedComp.competition.id;

    // Admin checks competition status with full details
    const adminCompetitionResponse =
      await adminClient.getCompetition(competitionId);
    if (!adminCompetitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const adminCompetition = adminCompetitionResponse.competition;
    expect(adminCompetition.name).toBe(competitionName);
    expect(adminCompetition.status).toBe("active");
    expect(adminCompetition.description).toBeDefined();
    expect(adminCompetition.externalUrl).toBeDefined();
    expect(adminCompetition.imageUrl).toBeDefined();
    expect(adminCompetition.startDate).toBeDefined();
    expect(adminCompetition.endDate).toBeDefined();

    // Admin checks leaderboard
    const adminLeaderboardResponse = await adminClient.getCompetitionAgents(
      adminCompetition.id,
      { sort: "rank" },
    );
    expect(adminLeaderboardResponse.success).toBe(true);
    if (!adminLeaderboardResponse.success)
      throw new Error("Failed to get agents");

    expect(adminLeaderboardResponse.agents).toBeDefined();
    expect(adminLeaderboardResponse.agents).toBeInstanceOf(Array);

    // There should be one agent in the leaderboard
    expect(adminLeaderboardResponse.agents.length).toBe(1);
    expect(adminLeaderboardResponse.agents[0]?.name).toBe("Regular Agent");

    // Admin checks competition rules
    const adminRulesResponse = (await adminClient.getRules(
      competitionId,
    )) as CompetitionRulesResponse;
    expect(adminRulesResponse.success).toBe(true);
    expect(adminRulesResponse.rules).toBeDefined();
    expect(adminRulesResponse.rules.tradingRules).toBeDefined();
    expect(adminRulesResponse.rules.rateLimits).toBeDefined();
    expect(adminRulesResponse.rules.availableChains).toBeDefined();
    expect(adminRulesResponse.rules.slippageFormula).toBeDefined();

    // Regular agent checks all the same endpoints to verify they work for participants too
    const agentCompetitionResponse =
      await agentClient.getCompetition(competitionId);
    if (!agentCompetitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const agentCompetition = agentCompetitionResponse.competition;
    expect(agentCompetition.id).toBe(adminCompetition.id);
    expect(agentCompetition.status).toBe("active");

    const agentLeaderboardResponse = await agentClient.getCompetitionAgents(
      agentCompetition.id,
    );
    expect(agentLeaderboardResponse.success).toBe(true);

    // Regular agent checks rules
    const agentRulesResponse = await agentClient.getRules(competitionId);
    expect(agentRulesResponse.success).toBe(true);
  });

  test("agents can get list of upcoming competitions", async () => {
    // Setup admin client and register an agent
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming competitions viewer test",
    });

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

    // Call the competitions endpoint with pending status
    const upcomingResponse = (await agentClient.getCompetitions(
      "pending",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(upcomingResponse.success).toBe(true);
    expect(upcomingResponse.competitions).toBeDefined();
    expect(Array.isArray(upcomingResponse.competitions)).toBe(true);
    expect(upcomingResponse.competitions.length).toBe(3);

    // Validate pagination metadata
    expect(upcomingResponse.pagination).toBeDefined();
    expect(upcomingResponse.pagination.total).toBe(3); // total competitions created
    expect(upcomingResponse.pagination.limit).toBe(10); // default limit
    expect(upcomingResponse.pagination.offset).toBe(0); // default offset
    expect(typeof upcomingResponse.pagination.hasMore).toBe("boolean");
    expect(upcomingResponse.pagination.hasMore).toBe(false); // 3 competitions < 10 limit

    // Verify each competition has all expected fields
    upcomingResponse.competitions.forEach((comp) => {
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

    // Start one of the competitions to verify it disappears from upcoming list
    await startExistingTestCompetition({
      adminClient,
      competitionId: createResponse1.competition.id,
      agentIds: [agent.id],
    });

    // Get upcoming competitions again
    const upcomingResponseAfterStart = (await agentClient.getCompetitions(
      "pending",
    )) as UpcomingCompetitionsResponse;

    expect(upcomingResponseAfterStart.competitions.length).toBe(2);

    // Get active competitions
    const activeResponse = (await agentClient.getCompetitions(
      "active",
    )) as UpcomingCompetitionsResponse;

    expect(activeResponse.competitions.length).toBe(1);
  });

  test("viewing competitions with invalid querystring values returns 400", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming Viewer Agent",
    });

    // Create the competitions
    await adminClient.createCompetition({
      name: `Upcoming Competition ${Date.now()}`,
      description: "Test competition 1",
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });

    // Call the new endpoint to get competitions sorted by start date ascending
    const ascResponse = (await agentClient.getCompetitions(
      "pending",
      "foo",
    )) as ErrorResponse;

    expect(ascResponse.success).toBe(false);
    expect(ascResponse.status).toBe(400);
  });

  test("agents can view sorted competitions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Upcoming Viewer Agent",
    });

    // Create several competitions in PENDING state that are at least 1200 ms
    // apart in started date, since we are storing at a 1 second precision.
    const comp1Name = `Upcoming Competition 1 ${Date.now()}`;
    const comp2Name = `Upcoming Competition 2 ${Date.now()}`;
    const comp3Name = `Upcoming Competition 3 ${Date.now()}`;

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

    // Call the new endpoint to get competitions sorted by start date ascending
    const ascResponse = (await agentClient.getCompetitions(
      "pending",
      "createdAt",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(ascResponse.success).toBe(true);
    expect(ascResponse.competitions).toBeDefined();
    expect(Array.isArray(ascResponse.competitions)).toBe(true);
    expect(ascResponse.competitions[0]?.name).toBe(comp1Name);
    expect(ascResponse.competitions[1]?.name).toBe(comp2Name);
    expect(ascResponse.competitions[2]?.name).toBe(comp3Name);

    // Call the new endpoint to get competitions sorted by start date descending NOTE: the '-' at the beginning of the sort value
    const descResponse = (await agentClient.getCompetitions(
      "pending",
      "-createdAt",
    )) as UpcomingCompetitionsResponse;

    // Verify the response
    expect(descResponse.success).toBe(true);
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

    // Register a user/agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Agent",
    });

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
    const firstPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      0,
    )) as UpcomingCompetitionsResponse;

    expect(firstPageResponse.success).toBe(true);
    expect(firstPageResponse.competitions.length).toBe(3);
    expect(firstPageResponse.pagination.total).toBe(5);
    expect(firstPageResponse.pagination.limit).toBe(3);
    expect(firstPageResponse.pagination.offset).toBe(0);
    expect(firstPageResponse.pagination.hasMore).toBe(true); // 0 + 3 < 5

    // Test second page with limit 3, offset 3
    const secondPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      3,
    )) as UpcomingCompetitionsResponse;

    expect(secondPageResponse.success).toBe(true);
    expect(secondPageResponse.competitions.length).toBe(2); // remaining competitions
    expect(secondPageResponse.pagination.total).toBe(5);
    expect(secondPageResponse.pagination.limit).toBe(3);
    expect(secondPageResponse.pagination.offset).toBe(3);
    expect(secondPageResponse.pagination.hasMore).toBe(false); // 3 + 3 > 5

    // Test beyond last page
    const emptyPageResponse = (await agentClient.getCompetitions(
      "pending",
      undefined,
      3,
      6,
    )) as UpcomingCompetitionsResponse;

    expect(emptyPageResponse.success).toBe(true);
    expect(emptyPageResponse.competitions.length).toBe(0);
    expect(emptyPageResponse.pagination.total).toBe(5);
    expect(emptyPageResponse.pagination.limit).toBe(3);
    expect(emptyPageResponse.pagination.offset).toBe(6);
    expect(emptyPageResponse.pagination.hasMore).toBe(false); // 6 + 3 > 5
  });

  // test cases for GET /competitions/{competitionId}

  // test cases for GET /competitions/{competitionId}/agents
  test("should get competition agents with scores and ranks", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { client: agentClient1, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
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
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Get competition agents
    const agentsResponse = await agentClient1.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);

    const agentsData = agentsResponse as CompetitionAgentsResponse;
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
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("should return 404 for agents of non-existent competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "404 Agents Test Agent",
    });

    // Try to get agents for a non-existent competition
    const response = await agentClient.getCompetitionAgents(
      "00000000-0000-0000-0000-000000000000",
    );

    // Should return error response
    expect(response.success).toBe(false);
    expect((response as ErrorResponse).error).toContain("not found");
  });

  test("should handle competitions with no agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent for testing
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Empty Competition Test Agent",
    });

    // Create a competition without starting it (no agents)
    const competitionName = `Empty Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
    });

    // Test getting agents for competition with no agents
    const agentsResponse = (await agentClient.getCompetitionAgents(
      createResponse.competition.id,
    )) as CompetitionAgentsResponse;

    // Verify the response
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.competitionId).toBe(createResponse.competition.id);
    expect(agentsResponse.agents).toBeDefined();
    expect(Array.isArray(agentsResponse.agents)).toBe(true);
    expect(agentsResponse.agents.length).toBe(0);
  });

  test("should handle agent data completeness and ordering", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents with different names for ordering test
    const { client: agentClient, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Charlie",
      });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Alpha",
    });
    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent Beta",
    });

    // Start a competition with multiple agents
    const competitionName = `Ordering Test Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    // Test getting competition agents
    const agentsResponse = (await agentClient.getCompetitionAgents(
      startResponse.competition.id,
    )) as CompetitionAgentsResponse;

    // Verify the response
    expect(agentsResponse.success).toBe(true);
    expect(agentsResponse.agents.length).toBe(3);

    // Verify ranks are sequential
    agentsResponse.agents.forEach((agent, index) => {
      expect(agent.rank).toBe(index + 1);

      // Verify all required fields are present and have correct types
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(typeof agent.score).toBe("number");
      expect(typeof agent.rank).toBe("number");
      expect(typeof agent.portfolioValue).toBe("number");
      expect(typeof agent.active).toBe("boolean");

      // Verify new PnL and 24h change fields
      expect(typeof agent.pnl).toBe("number");
      expect(typeof agent.pnlPercent).toBe("number");
      expect(typeof agent.change24h).toBe("number");
      expect(typeof agent.change24hPercent).toBe("number");

      // Optional fields should be null or string
      if (agent.description !== null) {
        expect(typeof agent.description).toBe("string");
      }
      if (agent.imageUrl !== null) {
        expect(typeof agent.imageUrl).toBe("string");
      }
      if (agent.deactivationReason !== null) {
        expect(typeof agent.deactivationReason).toBe("string");
      }
    });
  });

  // test cases for Privy user authentication
  test("Privy users can access competition details endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competition Detail User",
      userEmail: "siwe-competition-detail@example.com",
    });

    // Create a competition
    const competitionName = `Privy Detail Test Competition ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition for Privy user access",
    });

    // Test Privy user can get competition details by ID
    const detailResponse = await siweClient.getCompetition(
      createResponse.competition.id,
    );

    // Verify the response
    expect(detailResponse.success).toBe(true);
    expect(
      (detailResponse as CompetitionDetailResponse).competition,
    ).toBeDefined();
    expect((detailResponse as CompetitionDetailResponse).competition.id).toBe(
      createResponse.competition.id,
    );
    expect((detailResponse as CompetitionDetailResponse).competition.name).toBe(
      competitionName,
    );
    expect(
      (detailResponse as CompetitionDetailResponse).competition.status,
    ).toBe("pending");

    // Test Privy user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetition(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("Privy users can access competition agents endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competition Agents User",
      userEmail: "siwe-competition-agents@example.com",
    });

    // Register multiple agents for the competition
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Test Agent One",
    });

    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Test Agent Two",
    });

    // Create and start a competition with multiple agents
    const competitionName = `Privy Agents Test Competition ${Date.now()}`;
    const startResponse = await adminClient.startCompetition({
      name: competitionName,
      description: "Test competition for Privy user agents access",
      agentIds: [agent1.id, agent2.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });

    expect(startResponse.success).toBe(true);
    const competition = (startResponse as StartCompetitionResponse).competition;

    // Test Privy user can get competition agents
    const agentsResponse = await siweClient.getCompetitionAgents(
      competition.id,
    );
    expect(agentsResponse.success).toBe(true);

    const agentsData = agentsResponse as CompetitionAgentsResponse;
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

    // Test Privy user gets 404 for non-existent competition
    const notFoundResponse = await siweClient.getCompetitionAgents(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(notFoundResponse.success).toBe(false);
    expect((notFoundResponse as ErrorResponse).error).toContain("not found");
  });

  test("Privy users can access existing competitions endpoint", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Competitions List User",
      userEmail: "siwe-competitions-list@example.com",
    });

    // Create several competitions in different states
    const pendingComp = await createTestCompetition({
      adminClient,
      name: `Pending Competition ${Date.now()}`,
    });

    // Register an agent for active competition
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Privy Active Competition Agent",
    });

    const activeComp = await startTestCompetition({
      adminClient,
      name: `Active Competition ${Date.now()}`,
      agentIds: [agent.id],
    });

    // Test Privy user can get pending competitions
    const pendingResponse = await siweClient.getCompetitions("pending");
    expect(pendingResponse.success).toBe(true);
    expect(
      (pendingResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();

    // Should find our pending competition
    const foundPending = (
      pendingResponse as UpcomingCompetitionsResponse
    ).competitions.find((comp) => comp.id === pendingComp.competition.id);
    expect(foundPending).toBeDefined();

    // Test Privy user can get active competitions
    const activeResponse = await siweClient.getCompetitions("active");
    expect(activeResponse.success).toBe(true);
    expect(
      (activeResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();

    // Should find our active competition
    const foundActive = (
      activeResponse as UpcomingCompetitionsResponse
    ).competitions.find((comp) => comp.id === activeComp.competition.id);
    expect(foundActive).toBeDefined();

    // Test Privy user can use sorting
    const sortedResponse = await siweClient.getCompetitions(
      "pending",
      "createdAt",
    );
    expect(sortedResponse.success).toBe(true);
    expect(
      (sortedResponse as UpcomingCompetitionsResponse).competitions,
    ).toBeDefined();
  });

  test("Privy users have same access as agent API key users for competition endpoints", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create a Privy-authenticated user client
    const { client: siweClient } = await createPrivyAuthenticatedClient({
      userName: "Privy Access Comparison User",
      userEmail: "siwe-access-comparison@example.com",
    });

    // Create an agent API key authenticated client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "API Key Access Comparison Agent",
      });

    // Create and start a competition
    const competitionName = `Access Comparison Competition ${Date.now()}`;
    const startResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const competitionId = startResponse.competition.id;

    // Test both clients can access competition details
    const siweDetailResponse = await siweClient.getCompetition(competitionId);
    const agentDetailResponse = await agentClient.getCompetition(competitionId);

    expect(siweDetailResponse.success).toBe(true);
    expect(agentDetailResponse.success).toBe(true);

    // Both should return the same competition data
    expect(
      (siweDetailResponse as CompetitionDetailResponse).competition.id,
    ).toBe((agentDetailResponse as CompetitionDetailResponse).competition.id);
    expect(
      (siweDetailResponse as CompetitionDetailResponse).competition.name,
    ).toBe((agentDetailResponse as CompetitionDetailResponse).competition.name);

    // Test both clients can access competition agents
    const siweAgentsResponse =
      await siweClient.getCompetitionAgents(competitionId);
    const agentAgentsResponse =
      await agentClient.getCompetitionAgents(competitionId);

    expect(siweAgentsResponse.success).toBe(true);
    expect(agentAgentsResponse.success).toBe(true);

    // Both should return the same agents data
    expect(
      (siweAgentsResponse as CompetitionAgentsResponse).agents.length,
    ).toBe((agentAgentsResponse as CompetitionAgentsResponse).agents.length);

    // Test both clients can access competitions list
    const siweListResponse = await siweClient.getCompetitions("active");
    const agentListResponse = await agentClient.getCompetitions("active");

    expect(siweListResponse.success).toBe(true);
    expect(agentListResponse.success).toBe(true);

    // Both should return the same competitions list
    expect(
      (siweListResponse as UpcomingCompetitionsResponse).competitions.length,
    ).toBe(
      (agentListResponse as UpcomingCompetitionsResponse).competitions.length,
    );
  });

  test("should get competition agents with API key authentication", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent, client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Agents Test Agent",
    });

    // Start a competition with our agent
    const competitionName = `Competition Agents Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = startResult.competition.id;

    // Get competition agents using agent API key
    const response = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
    expect(response.competitionId).toBe(competitionId);
    expect(response.agents).toBeDefined();
    expect(Array.isArray(response.agents)).toBe(true);
    expect(response.agents.length).toBe(1);

    const agentData = response.agents[0]!;
    expect(agentData).toBeDefined();
    expect(agentData.id).toBe(agent.id);
    expect(agentData.name).toBe(agent.name);
    expect(typeof agentData.score).toBe("number");
    expect(typeof agentData.rank).toBe("number");
    expect(typeof agentData.portfolioValue).toBe("number");
    expect(typeof agentData.active).toBe("boolean");

    // Verify new PnL and 24h change fields
    expect(typeof agentData.pnl).toBe("number");
    expect(typeof agentData.pnlPercent).toBe("number");
    expect(typeof agentData.change24h).toBe("number");
    expect(typeof agentData.change24hPercent).toBe("number");
  });

  test("should calculate PnL and 24h change fields correctly", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: client1 } =
      await registerUserAndAgentAndGetClient({
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
    const response = (await client1.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
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
    const { competition } = (await client1.getCompetition(
      competitionId,
    )) as CompetitionDetailResponse;
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
    const { agent, client } = await registerUserAndAgentAndGetClient({
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
    const response = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
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
    const perpsCompId = (perpsComp as CreateCompetitionResponse).competition.id;
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
      await adminClient.getCompetitionAgents(pendingTradingCompId);
    expect(pendingTradingAgentsResponse.success).toBe(true);
    const pendingTradingAgents = (
      pendingTradingAgentsResponse as CompetitionAgentsResponse
    ).agents;
    const agent1Trading = pendingTradingAgents.find((a) => a.id === agent1.id);
    const agent3Trading = pendingTradingAgents.find((a) => a.id === agent3.id);
    expect(agent1Trading!.rank).toBe(1);
    expect(agent3Trading!.rank).toBe(2);

    const pendingPerpsAgentsResponse =
      await adminClient.getCompetitionAgents(pendingPerpsCompId);
    expect(pendingPerpsAgentsResponse.success).toBe(true);
    const pendingPerpsAgents = (
      pendingPerpsAgentsResponse as CompetitionAgentsResponse
    ).agents;
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

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Client Agent",
    });

    // Test pagination with limit=2, offset=0
    const page1Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(page1Response.success).toBe(true);
    expect(page1Response.agents.length).toBe(2);
    expect(page1Response.pagination.total).toBe(5);
    expect(page1Response.pagination.limit).toBe(2);
    expect(page1Response.pagination.offset).toBe(0);
    expect(page1Response.pagination.hasMore).toBe(true);

    // Test pagination with limit=2, offset=2
    const page2Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 2,
    })) as CompetitionAgentsResponse;

    expect(page2Response.success).toBe(true);
    expect(page2Response.agents.length).toBe(2);
    expect(page2Response.pagination.total).toBe(5);
    expect(page2Response.pagination.limit).toBe(2);
    expect(page2Response.pagination.offset).toBe(2);
    expect(page2Response.pagination.hasMore).toBe(true);

    // Test pagination with limit=2, offset=4 (last page)
    const page3Response = (await client.getCompetitionAgents(competitionId, {
      limit: 2,
      offset: 4,
    })) as CompetitionAgentsResponse;

    expect(page3Response.success).toBe(true);
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

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Filter Test Client Agent",
    });

    // Test filtering by "Filter" - should return Alpha and Beta agents
    const filterResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "Filter",
    })) as CompetitionAgentsResponse;

    expect(filterResponse.success).toBe(true);
    expect(filterResponse.agents.length).toBe(2);
    expect(filterResponse.pagination.total).toBe(2);

    const filteredNames = filterResponse.agents.map((a) => a.name);
    expect(filteredNames).toContain("Alpha Filter Agent");
    expect(filteredNames).toContain("Beta Filter Agent");
    expect(filteredNames).not.toContain("Gamma Different Agent");

    // Test filtering by "Alpha" - should return only Alpha agent
    const alphaResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "Alpha",
    })) as CompetitionAgentsResponse;

    expect(alphaResponse.success).toBe(true);
    expect(alphaResponse.agents.length).toBe(1);
    expect(alphaResponse.agents[0]?.name).toBe("Alpha Filter Agent");

    // Test filtering by non-existent term
    const noMatchResponse = (await client.getCompetitionAgents(competitionId, {
      filter: "NonExistent",
    })) as CompetitionAgentsResponse;

    expect(noMatchResponse.success).toBe(true);
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

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Sort Test Client Agent",
    });
    // Force a snapshot directly
    await portfolioSnapshotterService.takePortfolioSnapshots(competitionId);

    // Test sorting by default (rank)
    const rankDefaultResponse = (await client.getCompetitionAgents(
      competitionId,
    )) as CompetitionAgentsResponse;

    expect(rankDefaultResponse.success).toBe(true);
    expect(rankDefaultResponse.agents[0]!.rank).toBe(1);
    expect(rankDefaultResponse.agents[1]!.rank).toBe(2);
    expect(rankDefaultResponse.agents[2]!.rank).toBe(3);

    // Test sorting by name (ascending)
    const nameAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "name",
    })) as CompetitionAgentsResponse;

    expect(nameAscResponse.success).toBe(true);
    expect(nameAscResponse.agents.length).toBe(3);

    const nameAscOrder = nameAscResponse.agents.map((a) => a.name);
    expect(nameAscOrder[0]).toBe("Alpha Sort Agent");
    expect(nameAscOrder[1]).toBe("Beta Sort Agent");
    expect(nameAscOrder[2]).toBe("Charlie Sort Agent");

    // Test sorting by name (descending)
    const nameDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-name",
    })) as CompetitionAgentsResponse;

    expect(nameDescResponse.success).toBe(true);
    expect(nameDescResponse.agents.length).toBe(3);

    const nameDescOrder = nameDescResponse.agents.map((a) => a.name);
    expect(nameDescOrder[0]).toBe("Charlie Sort Agent");
    expect(nameDescOrder[1]).toBe("Beta Sort Agent");
    expect(nameDescOrder[2]).toBe("Alpha Sort Agent");

    // Test sorting by rank
    const rankAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "rank",
    })) as CompetitionAgentsResponse;

    expect(rankAscResponse.success).toBe(true);
    expect(rankAscResponse.agents[0]!.rank).toBe(1);
    expect(rankAscResponse.agents[1]!.rank).toBe(2);
    expect(rankAscResponse.agents[2]!.rank).toBe(3);

    // Test sorting by rank (descending)
    const rankDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-rank",
    })) as CompetitionAgentsResponse;
    expect(rankDescResponse.success).toBe(true);
    expect(rankDescResponse.agents[0]!.rank).toBe(3);
    expect(rankDescResponse.agents[1]!.rank).toBe(2);
    expect(rankDescResponse.agents[2]!.rank).toBe(1);

    // Test sorting by score (ascending)
    const scoreAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "score",
    })) as CompetitionAgentsResponse;
    expect(scoreAscResponse.success).toBe(true);
    expect(scoreAscResponse.agents[0]!.score).toBeLessThanOrEqual(
      scoreAscResponse.agents[1]!.score,
    );
    expect(scoreAscResponse.agents[1]!.score).toBeLessThanOrEqual(
      scoreAscResponse.agents[2]!.score,
    );

    // Test sorting by score (descending)
    const scoreDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-score",
      },
    )) as CompetitionAgentsResponse;
    expect(scoreDescResponse.success).toBe(true);
    expect(scoreDescResponse.agents[0]!.score).toBeGreaterThanOrEqual(
      scoreDescResponse.agents[1]!.score,
    );
    expect(scoreDescResponse.agents[1]!.score).toBeGreaterThanOrEqual(
      scoreDescResponse.agents[2]!.score,
    );

    // Test sorting by portfolioValue (ascending)
    const portfolioValueAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "portfolioValue",
      },
    )) as CompetitionAgentsResponse;
    expect(portfolioValueAscResponse.success).toBe(true);
    expect(
      portfolioValueAscResponse.agents[0]!.portfolioValue,
    ).toBeLessThanOrEqual(portfolioValueAscResponse.agents[1]!.portfolioValue);
    expect(
      portfolioValueAscResponse.agents[1]!.portfolioValue,
    ).toBeLessThanOrEqual(portfolioValueAscResponse.agents[2]!.portfolioValue);

    // Test sorting by portfolioValue (descending)
    const portfolioValueDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-portfolioValue",
      },
    )) as CompetitionAgentsResponse;
    expect(portfolioValueDescResponse.success).toBe(true);
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
    const pnlAscResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "pnl",
    })) as CompetitionAgentsResponse;
    expect(pnlAscResponse.success).toBe(true);
    expect(pnlAscResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
      pnlAscResponse.agents[1]!.pnl,
    );
    expect(pnlAscResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
      pnlAscResponse.agents[2]!.pnl,
    );

    // Check PnL (descending)
    const pnlDescResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "-pnl",
    })) as CompetitionAgentsResponse;
    expect(pnlDescResponse.success).toBe(true);
    expect(pnlDescResponse.agents[0]!.pnl).toBeGreaterThanOrEqual(
      pnlDescResponse.agents[1]!.pnl,
    );
    expect(pnlDescResponse.agents[1]!.pnl).toBeGreaterThanOrEqual(
      pnlDescResponse.agents[2]!.pnl,
    );

    // Verify PnL percentage is in ascending order
    const pnlPercentAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "pnlPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(pnlPercentAscResponse.success).toBe(true);
    expect(pnlPercentAscResponse.agents[0]!.pnlPercent).toBeGreaterThanOrEqual(
      pnlPercentAscResponse.agents[1]!.pnlPercent,
    );
    expect(pnlPercentAscResponse.agents[1]!.pnlPercent).toBeGreaterThanOrEqual(
      pnlPercentAscResponse.agents[2]!.pnlPercent,
    );

    // Verify PnL percentage is in descending order
    const pnlPercentDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-pnlPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(pnlPercentDescResponse.success).toBe(true);
    expect(pnlPercentDescResponse.agents[0]!.pnlPercent).toBeLessThanOrEqual(
      pnlPercentDescResponse.agents[1]!.pnlPercent,
    );
    expect(pnlPercentDescResponse.agents[1]!.pnlPercent).toBeLessThanOrEqual(
      pnlPercentDescResponse.agents[2]!.pnlPercent,
    );

    // Verify change24h is in ascending order
    const change24hAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "change24h",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hAscResponse.success).toBe(true);
    expect(change24hAscResponse.agents[0]!.change24h).toBeGreaterThanOrEqual(
      change24hAscResponse.agents[1]!.change24h,
    );
    expect(change24hAscResponse.agents[1]!.change24h).toBeGreaterThanOrEqual(
      change24hAscResponse.agents[2]!.change24h,
    );

    // Verify change24h is in descending order
    const change24hDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-change24h",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hDescResponse.success).toBe(true);
    expect(change24hDescResponse.agents[0]!.change24h).toBeLessThanOrEqual(
      change24hDescResponse.agents[1]!.change24h,
    );
    expect(change24hDescResponse.agents[1]!.change24h).toBeLessThanOrEqual(
      change24hDescResponse.agents[2]!.change24h,
    );

    // Verify change24h percentage is in ascending order
    const change24hPercentAscResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "change24hPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hPercentAscResponse.success).toBe(true);
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
    const change24hPercentDescResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "-change24hPercent",
      },
    )) as CompetitionAgentsResponse;
    expect(change24hPercentDescResponse.success).toBe(true);
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

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Pagination Test Client Agent",
    });

    // Test 1: Database sorting
    const dbSortResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "name", // Database field (no computed fields)
      limit: 3,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(dbSortResponse.success).toBe(true);
    expect(dbSortResponse.agents.length).toBe(3);
    expect(dbSortResponse.pagination.limit).toBe(3);
    expect(dbSortResponse.pagination.offset).toBe(0);
    expect(dbSortResponse.pagination.total).toBe(6);
    expect(dbSortResponse.pagination.hasMore).toBe(true);

    // Test 2: Computed sorting
    const computedSortResponse = (await client.getCompetitionAgents(
      competitionId,
      {
        sort: "rank", // Computed field
        limit: 3,
        offset: 0,
      },
    )) as CompetitionAgentsResponse;

    expect(computedSortResponse.success).toBe(true);

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
      const response = (await client.getCompetitionAgents(competitionId, {
        sort: field,
        limit: 2,
        offset: 0,
      })) as CompetitionAgentsResponse;

      expect(response.success).toBe(true);
      expect(response.agents.length).toBe(2);
      expect(response.pagination.limit).toBe(2);
    }

    // Test 4: Demonstrate that offset is also ignored
    const offsetResponse = (await client.getCompetitionAgents(competitionId, {
      sort: "rank",
      limit: 2,
      offset: 3, // Should skip first 3 agents
    })) as CompetitionAgentsResponse;

    expect(offsetResponse.success).toBe(true);
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

    // Create a client for testing
    const { client } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Combined Test Client Agent",
    });

    // Test filtering by "Test", sorting by name, with pagination
    const response = (await client.getCompetitionAgents(competitionId, {
      filter: "Test",
      sort: "name",
      limit: 2,
      offset: 0,
    })) as CompetitionAgentsResponse;

    expect(response.success).toBe(true);
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
    const page2Response = (await client.getCompetitionAgents(competitionId, {
      filter: "Test",
      sort: "name",
      limit: 2,
      offset: 2,
    })) as CompetitionAgentsResponse;

    expect(page2Response.success).toBe(true);
    expect(page2Response.agents.length).toBe(2);
    expect(page2Response.pagination.total).toBe(4);
    expect(page2Response.pagination.hasMore).toBe(false);
  });

  test("should validate query parameters for competition agents", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client } = await registerUserAndAgentAndGetClient({
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
    try {
      await client.getCompetitionAgents(competitionId, {
        limit: 150, // Max is 100
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid limit (too low)
    try {
      await client.getCompetitionAgents(competitionId, {
        limit: 0, // Min is 1
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test invalid offset (negative)
    try {
      await client.getCompetitionAgents(competitionId, {
        offset: -1, // Min is 0
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
    }

    // Test valid parameters should work
    const validResponse = (await client.getCompetitionAgents(competitionId, {
      limit: 50,
      offset: 0,
      sort: "name",
      filter: "Test",
    })) as CompetitionAgentsResponse;

    expect(validResponse.success).toBe(true);
  });

  // test cases for join/leave competition functionality

  describe("Competition Join Date Constraints", () => {});

  describe("Public Competition Access (No Authentication Required)", () => {
    test("should allow unauthenticated access to GET /competitions", async () => {
      // Setup: Create test competition via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      await createTestCompetition({
        adminClient,
        name: "Public Test Competition",
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(`${getBaseUrl()}/api/competitions`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competitions).toBeDefined();
      expect(Array.isArray(response.data.competitions)).toBe(true);
    });

    test("should allow unauthenticated access to GET /competitions/{id}", async () => {
      // Setup: Create test competition via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);
      const { competition } = await createTestCompetition({
        adminClient,
        name: "Public Test Competition Details",
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competition).toBeDefined();
      expect(response.data.competition.id).toBe(competition.id);
      expect(response.data.competition.name).toBe(
        "Public Test Competition Details",
      );
    });

    test("should allow unauthenticated access to GET /competitions/{id}/agents", async () => {
      // Setup: Create competition with agents via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Public Test Agent",
      });

      const { competition } = await startTestCompetition({
        adminClient,
        name: "Public Competition with Agents",
        agentIds: [agent.id],
      });

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}/agents`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competitionId).toBe(competition.id);
      expect(response.data.agents).toBeDefined();
      expect(Array.isArray(response.data.agents)).toBe(true);
    });

    test("should allow unauthenticated access to GET /competitions/{id}/rules", async () => {
      // Setup: Create competition with trading constraints via admin
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Public Rules Competition ${Date.now()}`;
      const customConstraints = {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 50000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition for public rules access",
        tradingConstraints: customConstraints,
      });

      expect(createResponse.success).toBe(true);
      const { competition } = createResponse as CreateCompetitionResponse;

      // Test: Direct axios call without authentication
      const response = await axios.get(
        `${getBaseUrl()}/api/competitions/${competition.id}/rules`,
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.competition).toBeDefined();
      expect(response.data.competition.id).toBe(competition.id);
      expect(response.data.rules).toBeDefined();
      expect(response.data.rules.tradingRules).toBeDefined();
      expect(response.data.rules.rateLimits).toBeDefined();
      expect(response.data.rules.availableChains).toBeDefined();
      expect(response.data.rules.slippageFormula).toBeDefined();
      expect(response.data.rules.tradingConstraints).toBeDefined();
      expect(response.data.rules.tradingConstraints.minimumPairAgeHours).toBe(
        24,
      );
      expect(response.data.rules.tradingConstraints.minimum24hVolumeUsd).toBe(
        50000,
      );
      expect(response.data.rules.tradingConstraints.minimumLiquidityUsd).toBe(
        100000,
      );
      expect(response.data.rules.tradingConstraints.minimumFdvUsd).toBe(
        1000000,
      );
    });

    test("should handle minTradesPerDay in competition creation and retrieval", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with minTradesPerDay set
      const competitionName = `Min Trades Test Competition ${Date.now()}`;
      const minTradesConstraints = {
        minimumPairAgeHours: 12,
        minimum24hVolumeUsd: 10000,
        minimumLiquidityUsd: 50000,
        minimumFdvUsd: 500000,
        minTradesPerDay: 5,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with min trades per day",
        tradingConstraints: minTradesConstraints,
      });

      expect(createResponse.success).toBe(true);
      expect("competition" in createResponse).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay appears in rules endpoint (public)
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints).toBeDefined();
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(5);

      // Verify the rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement: 5 trades"),
      );
      expect(minTradesRule).toBeDefined();

      // Verify minTradesPerDay appears in competition detail endpoint (public)
      const detailResponse = await adminClient.getCompetition(competitionId);
      expect(detailResponse.success).toBe(true);
      expect("competition" in detailResponse).toBe(true);
      const competition = (detailResponse as CompetitionDetailResponse)
        .competition;
      expect(competition.tradingConstraints).toBeDefined();
      expect(competition.tradingConstraints?.minTradesPerDay).toBe(5);
    });

    test("should handle null minTradesPerDay in competition creation", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with minTradesPerDay explicitly set to null
      const competitionName = `Null Min Trades Test ${Date.now()}`;
      const nullMinTradesConstraints = {
        minimumPairAgeHours: 12,
        minimum24hVolumeUsd: 10000,
        minimumLiquidityUsd: 50000,
        minimumFdvUsd: 500000,
        minTradesPerDay: null,
      };

      const createResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition with null min trades per day",
        tradingConstraints: nullMinTradesConstraints,
      });

      expect(createResponse.success).toBe(true);
      expect("competition" in createResponse).toBe(true);
      const competitionId = (createResponse as CreateCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay is null in rules endpoint
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(null);

      // Verify no min trades rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement"),
      );
      expect(minTradesRule).toBeUndefined();
    });

    test("should show minTradesPerDay for authenticated users in competitions list", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a Privy authenticated client
      const { client: userClient } = await createPrivyAuthenticatedClient({});

      // Create a pending competition with minTradesPerDay
      const competitionName = `Listed Competition ${Date.now()}`;
      const constraintsWithMinTrades = {
        minimumPairAgeHours: 24,
        minimum24hVolumeUsd: 20000,
        minimumLiquidityUsd: 100000,
        minimumFdvUsd: 1000000,
        minTradesPerDay: 10,
      };

      await adminClient.createCompetition({
        name: competitionName,
        description: "Competition for listing test",
        tradingConstraints: constraintsWithMinTrades,
      });

      // Get competitions list as authenticated user
      const listResponse = await userClient.getCompetitions("pending");
      expect(listResponse.success).toBe(true);
      expect("competitions" in listResponse).toBe(true);

      // Find our competition
      const competitions = (listResponse as UpcomingCompetitionsResponse)
        .competitions;
      const ourCompetition = competitions.find(
        (c) => c.name === competitionName,
      );
      expect(ourCompetition).toBeDefined();
      expect(ourCompetition?.tradingConstraints).toBeDefined();
      expect(ourCompetition?.tradingConstraints?.minTradesPerDay).toBe(10);
    });

    test("should handle minTradesPerDay when starting a competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Min Trades Agent 1",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Min Trades Agent 2",
      });

      // Start a competition with minTradesPerDay using strictTradingConstraints (which has minTradesPerDay: 10)
      const competitionName = `Started Min Trades Competition ${Date.now()}`;
      const startResponse = await adminClient.startCompetition({
        name: competitionName,
        description: "Competition with min trades per day requirement",
        agentIds: [agent1.id, agent2.id],
        tradingConstraints: strictTradingConstraints,
      });

      expect(startResponse.success).toBe(true);
      expect("competition" in startResponse).toBe(true);
      const competitionId = (startResponse as StartCompetitionResponse)
        .competition.id;

      // Verify minTradesPerDay appears in rules endpoint
      const rulesResponse =
        await adminClient.getCompetitionRules(competitionId);
      expect(rulesResponse.success).toBe(true);
      expect("rules" in rulesResponse).toBe(true);
      const rules = (rulesResponse as CompetitionRulesResponse).rules;
      expect(rules.tradingConstraints?.minTradesPerDay).toBe(10);

      // Verify the rule string is included
      const minTradesRule = rules.tradingRules.find((rule: string) =>
        rule.includes("Minimum trades per day requirement: 10 trades"),
      );
      expect(minTradesRule).toBeDefined();
    });

    test("should return 404 for non-existent competition in public endpoints", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Test all four public endpoints with non-existent ID
      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });

      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}/agents`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });

      await expect(
        axios.get(`${getBaseUrl()}/api/competitions/${nonExistentId}/rules`),
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    test("rules endpoint should be publicly accessible", async () => {
      // Setup: Create a competition (don't need to start it, just test the path parameter functionality)
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const competitionName = `Public Rules Test ${Date.now()}`;
      const competitionResponse = await adminClient.createCompetition({
        name: competitionName,
        description: "Test competition for public rules access",
        tradingConstraints: {
          minimumPairAgeHours: 24,
          minimum24hVolumeUsd: 50000,
          minimumLiquidityUsd: 100000,
          minimumFdvUsd: 1000000,
        },
      });

      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse as CreateCompetitionResponse;

      // Test with specific competition ID via path parameter (public access)
      const rulesResponse = (await adminClient.getCompetitionRules(
        competition.competition.id,
      )) as CompetitionRulesResponse;
      expect(rulesResponse.rules).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints).toBeDefined();
      expect(rulesResponse.rules.tradingConstraints!.minimumPairAgeHours).toBe(
        24,
      );
    });

    test("join/leave competition endpoints should still require authentication", async () => {
      // Setup: Create test competition and agent
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Protected Test Agent",
      });

      const { competition } = await createTestCompetition({
        adminClient,
        name: "Protected Test Competition",
      });

      // Test: Join endpoint without authentication
      await expect(
        axios.post(
          `${getBaseUrl()}/api/competitions/${competition.id}/agents/${agent.id}`,
        ),
      ).rejects.toMatchObject({
        response: { status: 401 },
      });

      // Test: Leave endpoint without authentication
      await expect(
        axios.delete(
          `${getBaseUrl()}/api/competitions/${competition.id}/agents/${agent.id}`,
        ),
      ).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });

  describe("Trophy Logic", () => {});

  describe("Competition Rewards Logic", () => {});

  describe("Participant Limits", () => {});

  describe("Participation Rules Enforcement", () => {});

  describe("Competition Partners", () => {});

  describe("Rewards Ineligibility", () => {});

  describe("Boost Time Decay Rate Configuration", () => {});

  describe("Paper Trading Initial Balances Configuration", () => {});

  describe("Paper Trading Config Configuration", () => {});
});
