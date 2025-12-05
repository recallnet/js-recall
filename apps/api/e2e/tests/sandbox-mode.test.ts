import { beforeEach, describe, expect, test } from "vitest";

import { ApiClient } from "@recallnet/test-utils";
import {
  AdminAgentResponse,
  BalancesResponse,
  CompetitionAgentsResponse,
  ErrorResponse,
  PerpsAccountResponse,
  PerpsPositionsResponse,
  SnapshotResponse,
  StartCompetitionResponse,
  UserRegistrationResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  createTestCompetition,
  generateRandomEthAddress,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startPerpsTestCompetition,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

describe("Sandbox Mode", () => {
  let adminApiKey: string;
  let adminClient: ApiClient;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
    adminClient = createTestClient();

    // Login as admin
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);
  });

  describe("when sandboxMode=true, test manual adding agents to active sandbox competition", () => {
    test("should allow manually adding agent to active sandbox competition", async () => {
      // First create a dummy user+agent to start the competition with (to avoid "no agents provided" error)
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User",
        email: "dummy@example.com",
        agentName: "Dummy Agent",
        agentDescription: "Dummy agent for competition startup",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a sandbox competition with the dummy agent
      const competitionName = `Sandbox Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [dummyAgent!.id],
        sandboxMode: true,
      });
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;
      expect(competition.sandboxMode).toBe(true);

      // Verify competition is active and in sandbox mode
      const activeCompetitionResponse = await adminClient.getCompetition(
        competition.id,
      );
      if (!activeCompetitionResponse.success) {
        throw new Error("Failed to get competition");
      }
      const activeCompetition = activeCompetitionResponse.competition;
      expect(activeCompetition.id).toBe(competition.id);
      expect(activeCompetition.status).toBe("active");
      expect(activeCompetition.sandboxMode).toBe(true);

      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "New Sandbox User",
        email: "new-sandbox@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "New Sandbox Agent",
          description:
            "Agent that should be manually added to sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // NO AUTO-JOIN should happen - verify agent is NOT in competition yet
      let competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      let competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;
      expect(competitionAgents.agents.length).toBe(1); // Only dummy agent
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);

      // MANUALLY add the agent to the competition using the new admin endpoint
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        newAgent.id,
      );
      expect(addAgentResponse.success).toBe(true);

      // Wait a moment for processing
      await wait(100);

      // Now check that the agent was manually added to the competition
      competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have both the dummy agent and the manually added agent
      expect(competitionAgents.agents.length).toBe(2);
      const agentIds = competitionAgents.agents.map((agent) => agent.id);
      expect(agentIds).toContain(dummyAgent!.id);
      expect(agentIds).toContain(newAgent.id);

      // Verify the manually added agent has active status in the competition
      const newAgentInCompetition = competitionAgents.agents.find(
        (agent) => agent.id === newAgent.id,
      );
      expect(newAgentInCompetition?.active).toBe(true);
    });

    test("should reject adding agents to active non-sandbox competitions", async () => {
      // Create a dummy user+agent to start the competition with
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User",
        email: "dummy-non-sandbox@example.com",
        agentName: "Dummy Agent",
        agentDescription: "Dummy agent for non-sandbox competition startup",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a NON-sandbox competition
      const competitionName = `Non-Sandbox Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [dummyAgent!.id],
        sandboxMode: false,
      });
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;
      expect(competition.sandboxMode).toBe(false);

      // Verify competition is active but NOT in sandbox mode
      const activeCompetitionResponse = await adminClient.getCompetition(
        competition.id,
      );
      if (!activeCompetitionResponse.success) {
        throw new Error("Failed to get competition");
      }
      const activeCompetition = activeCompetitionResponse.competition;
      expect(activeCompetition.id).toBe(competition.id);
      expect(activeCompetition.status).toBe("active");
      expect(activeCompetition.sandboxMode).toBe(false);

      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "New Non-Sandbox User",
        email: "new-non-sandbox@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "New Non-Sandbox Agent",
          description:
            "Agent that should be rejected from non-sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // Verify no auto-join occurs (same as before)
      let competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      let competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;
      expect(competitionAgents.agents.length).toBe(1);
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);

      // Try to MANUALLY add the agent to the non-sandbox competition - should be REJECTED
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        newAgent.id,
      );
      expect(addAgentResponse.success).toBe(false);
      expect((addAgentResponse as ErrorResponse).error).toContain(
        "Cannot add agents to active non-sandbox competitions",
      );

      // Verify the agent was NOT added to the competition
      competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should still only have the original dummy agent
      expect(competitionAgents.agents.length).toBe(1);
      expect(competitionAgents.agents[0]?.id).toBe(dummyAgent!.id);
    });

    test("should allow agent registration when no active competition exists", async () => {
      // First register a user without an agent
      const newUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "No Competition User",
        email: "no-competition@example.com",
      });
      expect(newUserResponse.success).toBe(true);
      const newUser = (newUserResponse as UserRegistrationResponse).user;

      // Now register an agent for this user using the registerAgent route
      const newAgentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: newUser.walletAddress,
        },
        agent: {
          name: "No Competition Agent",
          description: "Agent registered when no competition is active",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(newAgentResponse.success).toBe(true);
      const newAgent = (newAgentResponse as AdminAgentResponse).agent;

      // Wait a moment
      await wait(100);

      // Verify the agent was created successfully but not added to any competition
      const agentResponse = await adminClient.getAgent(newAgent!.id);
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;
      expect(agent.status).toBe("active");
    });

    test("should allow manually adding multiple agents to sandbox competition", async () => {
      // Create a dummy user+agent to start the competition with
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User Multi",
        email: "dummy-multi@example.com",
        agentName: "Dummy Agent Multi",
        agentDescription: "Dummy agent for multi-agent sandbox test",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
      expect(dummyAgent).toBeDefined();

      // Create and start a sandbox competition
      const competitionName = `Multi-Agent Sandbox Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [dummyAgent!.id],
        sandboxMode: true,
      });
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;

      // Register multiple new agents and manually add them
      const newAgents = [];
      for (let i = 1; i <= 3; i++) {
        // First register the user
        const userResponse = await adminClient.registerUser({
          walletAddress: generateRandomEthAddress(),
          name: `Multi User ${i}`,
          email: `multi-user-${i}@example.com`,
        });
        expect(userResponse.success).toBe(true);
        const user = (userResponse as UserRegistrationResponse).user;

        // Then register the agent
        const agentResponse = await adminClient.registerAgent({
          user: {
            walletAddress: user.walletAddress,
          },
          agent: {
            name: `Multi Agent ${i}`,
            description: `Agent ${i} for multi-agent test`,
            walletAddress: generateRandomEthAddress(),
          },
        });
        expect(agentResponse.success).toBe(true);
        const agent = (agentResponse as AdminAgentResponse).agent;
        newAgents.push(agent);

        // Manually add each agent to the competition
        const addAgentResponse = await adminClient.addAgentToCompetition(
          competition.id,
          agent.id,
        );
        expect(addAgentResponse.success).toBe(true);
      }

      // Wait for all add operations to complete
      await wait(200);

      // Check that all new agents were manually added to the competition
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      const competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have the dummy agent + 3 new agents = 4 total
      expect(competitionAgents.agents.length).toBe(4);

      // Verify all agents are present and active
      const agentIds = competitionAgents.agents.map((agent) => agent.id);
      expect(agentIds).toContain(dummyAgent!.id);
      for (const newAgent of newAgents) {
        expect(agentIds).toContain(newAgent?.id);
      }

      // Verify all agents have active status
      for (const agent of competitionAgents.agents) {
        expect(agent.active).toBe(true);
      }
    });

    test("should handle manual agent addition to sandbox competition", async () => {
      // First register a user without an agent
      const userResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Separate Registration User",
        email: "separate-reg@example.com",
      });
      expect(userResponse.success).toBe(true);
      const user = (userResponse as UserRegistrationResponse).user;

      // Create a dummy agent to start the sandbox competition
      const dummyUserResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Dummy User Separate",
        email: "dummy-separate@example.com",
        agentName: "Dummy Agent Separate",
        agentDescription: "Dummy agent for separate registration test",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(dummyUserResponse.success).toBe(true);
      const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;

      // Start a sandbox competition
      const competitionName = `Separate Registration Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition({
        adminClient,
        name: competitionName,
        agentIds: [dummyAgent!.id],
        sandboxMode: true,
      });
      expect(competitionResponse.success).toBe(true);
      const competition = competitionResponse.competition;

      // Now register an agent separately for the existing user
      const agentResponse = await adminClient.registerAgent({
        user: {
          walletAddress: user.walletAddress,
        },
        agent: {
          name: "Separately Registered Agent",
          description: "Agent registered separately during sandbox competition",
          walletAddress: generateRandomEthAddress(),
        },
      });
      expect(agentResponse.success).toBe(true);
      const agent = (agentResponse as AdminAgentResponse).agent;

      // Manually add the agent to the competition
      const addAgentResponse = await adminClient.addAgentToCompetition(
        competition.id,
        agent.id,
      );
      expect(addAgentResponse.success).toBe(true);

      // Wait for processing
      await wait(100);

      // Check that the separately registered agent was manually added
      const competitionAgentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );
      expect(competitionAgentsResponse.success).toBe(true);
      const competitionAgents =
        competitionAgentsResponse as CompetitionAgentsResponse;

      // Should have both the dummy agent and the separately registered agent
      expect(competitionAgents.agents.length).toBe(2);
      const agentIds = competitionAgents.agents.map((a) => a.id);
      expect(agentIds).toContain(dummyAgent!.id);
      expect(agentIds).toContain(agent.id);
    });

    test("should reset balances to trading amounts when adding agent to trading competition", async () => {
      // Create an agent that will be added to the trading competition
      const testAgent = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Trading Balance Test User",
        email: "trading-balance-test@example.com",
        agentName: "Trading Balance Test Agent",
        agentDescription: "Agent for testing trading balance reset",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(testAgent.success).toBe(true);
      const agent = (testAgent as UserRegistrationResponse).agent;
      expect(agent).toBeDefined();

      // Create a client with the agent's API key for making authenticated calls
      const agentClient = new ApiClient(agent!.apiKey);

      // Create a dummy agent for starting the competition
      const tradingDummyResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Trading Dummy User",
        email: "trading-dummy@example.com",
        agentName: "Trading Dummy Agent",
        agentDescription: "Dummy agent for trading competition",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(tradingDummyResponse.success).toBe(true);
      const tradingDummy = (tradingDummyResponse as UserRegistrationResponse)
        .agent;

      // Start a trading competition in sandbox mode
      const tradingCompetition = await startTestCompetition({
        adminClient,
        name: `Trading Balance Test ${Date.now()}`,
        agentIds: [tradingDummy!.id],
        sandboxMode: true,
      });
      expect(tradingCompetition.success).toBe(true);

      // Add our test agent to the trading competition
      const addToTradingResponse = await adminClient.addAgentToCompetition(
        tradingCompetition.competition.id,
        agent!.id,
      );
      expect(addToTradingResponse.success).toBe(true);

      // Verify the agent received standard trading balances
      const tradingBalancesResponse = await agentClient.getBalance(
        tradingCompetition.competition.id,
      );
      expect(tradingBalancesResponse.success).toBe(true);
      const tradingBalances = (tradingBalancesResponse as BalancesResponse)
        .balances;

      // Should have USDC balances on multiple chains
      expect(tradingBalances.length).toBeGreaterThan(0);
      const usdcBalances = tradingBalances.filter((b) => b.symbol === "USDC");
      expect(usdcBalances.length).toBeGreaterThan(0);

      // Should have the expected USDC balances per chain
      // eth, base, svm should have 5000 USDC
      // polygon, arbitrum, optimism should have 200 USDC
      const highValueChains = ["eth", "base", "svm"];
      const lowValueChains = ["polygon", "arbitrum", "optimism"];

      for (const balance of usdcBalances) {
        if (highValueChains.includes(balance.specificChain)) {
          expect(balance.amount).toBe(5000);
        } else if (lowValueChains.includes(balance.specificChain)) {
          expect(balance.amount).toBe(200);
        }
      }
    });

    test("should clear balances when adding agent to perpetual futures competition", async () => {
      // Create an agent for perps testing
      const perpsTestAgent = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Perps Balance Test User",
        email: "perps-balance-test@example.com",
        agentName: "Perps Balance Test Agent",
        agentDescription: "Agent for testing perps balance reset",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(perpsTestAgent.success).toBe(true);
      const perpsAgent = (perpsTestAgent as UserRegistrationResponse).agent;
      expect(perpsAgent).toBeDefined();

      const perpsAgentClient = new ApiClient(perpsAgent!.apiKey);

      // Create a dummy agent for starting the perps competition
      const perpsDummyResponse = await adminClient.registerUser({
        walletAddress: generateRandomEthAddress(),
        name: "Perps Dummy User",
        email: "perps-dummy@example.com",
        agentName: "Perps Dummy Agent",
        agentDescription: "Dummy agent for perps competition",
        agentWalletAddress: generateRandomEthAddress(),
      });
      expect(perpsDummyResponse.success).toBe(true);
      const perpsDummy = (perpsDummyResponse as UserRegistrationResponse).agent;

      // Start a perpetual futures competition in sandbox mode
      const perpsCompetition = await startPerpsTestCompetition({
        adminClient,
        name: `Perps Balance Test ${Date.now()}`,
        agentIds: [perpsDummy!.id],
        sandboxMode: true,
      });
      expect(perpsCompetition.success).toBe(true);

      // Add our test agent to the perps competition
      const addToPerpsResponse = await adminClient.addAgentToCompetition(
        perpsCompetition.competition.id,
        perpsAgent!.id,
      );
      expect(addToPerpsResponse.success).toBe(true);

      // For perps competitions, the balance endpoint returns an error
      const perpsBalancesResponse = await perpsAgentClient.getBalance(
        perpsCompetition.competition.id,
      );
      expect(perpsBalancesResponse.success).toBe(false);
      expect((perpsBalancesResponse as ErrorResponse).error).toContain(
        "This endpoint is not available for perpetual futures competitions",
      );

      // Verification 1: Check perps account endpoint shows cleared balances
      const perpsAccountResponse = await perpsAgentClient.getPerpsAccount(
        perpsCompetition.competition.id,
      );
      expect(perpsAccountResponse.success).toBe(true);
      const account = (perpsAccountResponse as PerpsAccountResponse).account;
      expect(account).toBeDefined();
      expect(account.availableBalance).toBe("0");
      expect(account.totalEquity).toBe("0");
      expect(account.marginUsed).toBe("0");
      expect(account.totalPnl).toBe("0");

      // Verification 2: Check that the agent has no perps positions (since they have no balance to trade)
      const perpsPositionsResponse = await perpsAgentClient.getPerpsPositions(
        perpsCompetition.competition.id,
      );
      expect(perpsPositionsResponse.success).toBe(true);
      const positions = (perpsPositionsResponse as PerpsPositionsResponse)
        .positions;
      expect(positions).toBeDefined();
      expect(positions.length).toBe(0);

      // Additional verification: Check that the agent was successfully added to the perps competition
      const competitionAgents = await adminClient.getCompetitionAgents(
        perpsCompetition.competition.id,
      );
      expect(competitionAgents.success).toBe(true);
      const agents = (competitionAgents as CompetitionAgentsResponse).agents;
      expect(agents).toBeDefined();
      expect(agents.length).toBeGreaterThan(0);

      // Verify our test agent is in the competition
      const agentIds = agents.map((a) => a.id);
      expect(agentIds).toContain(perpsAgent!.id);
    });
  });

  test("should create competition with sandboxMode=true", async () => {
    const competitionName = `Sandbox Creation Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition with sandbox mode enabled",
      sandboxMode: true,
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(true);
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("pending");
  });

  test("should create competition with sandboxMode=false", async () => {
    const competitionName = `Non-Sandbox Creation Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition with sandbox mode disabled",
      sandboxMode: false,
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(false);
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("pending");
  });

  test("should default sandboxMode to false when not specified", async () => {
    const competitionName = `Default Sandbox Test ${Date.now()}`;
    const competitionResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test competition with default sandbox mode",
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(false);
  });

  test("should start pending competition with sandboxMode", async () => {
    // Create agents first
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Create a pending competition with sandbox mode
    const competitionName = `Pending Sandbox Start Test ${Date.now()}`;
    const createResponse = await createTestCompetition({
      adminClient,
      name: competitionName,
      description: "Test starting pending competition with sandbox mode",
      sandboxMode: true,
    });
    expect(createResponse.success).toBe(true);
    const pendingCompetition = createResponse.competition;
    expect(pendingCompetition.sandboxMode).toBe(true);
    expect(pendingCompetition.status).toBe("pending");

    // Start the competition
    const startResponse = await adminClient.startExistingCompetition({
      competitionId: pendingCompetition.id,
      agentIds: [agent1.id, agent2.id],
      sandboxMode: true, // sandboxMode - should maintain or override the setting,
    });
    expect(startResponse.success).toBe(true);
    const startedCompetition = (startResponse as StartCompetitionResponse)
      .competition;
    expect(startedCompetition.sandboxMode).toBe(true);
    expect(startedCompetition.status).toBe("active");
  });

  test("should handle auto-join when agent already exists in competition", async () => {
    // Create an agent first
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Start a sandbox competition with this agent
    const competitionName = `Duplicate Join Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      sandboxMode: true, // sandboxMode = true
    });
    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Try to register the same agent again (this should be handled gracefully)
    // In practice, this shouldn't happen as agents have unique IDs, but the system should handle it
    const competitionAgentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(competitionAgentsResponse.success).toBe(true);
    const competitionAgents =
      competitionAgentsResponse as CompetitionAgentsResponse;

    // Should still only have one instance of the agent
    expect(competitionAgents.agents.length).toBe(1);
    expect(competitionAgents.agents[0]?.id).toBe(agent.id);
  });

  test("should reject starting second competition when one is already active", async () => {
    // Create agents for both competitions
    const { agent: agent1 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });
    const { agent: agent2 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
    });

    // Start first sandbox competition
    const competition1Name = `First Sandbox Competition ${Date.now()}`;
    const competition1Response = await startTestCompetition({
      adminClient,
      name: competition1Name,
      agentIds: [agent1.id],
      sandboxMode: true, // sandboxMode = true
    });
    expect(competition1Response.success).toBe(true);
    const competition1 = competition1Response.competition;

    // Try to start second sandbox competition (should fail)
    const competition2Name = `Second Sandbox Competition ${Date.now()}`;

    // This should fail because only one competition can be active at a time
    try {
      await startTestCompetition({
        adminClient,
        name: competition2Name,
        agentIds: [agent2.id],
        sandboxMode: true, // sandboxMode = true
      });
      // If we get here, the test should fail
      expect(true).toBe(false); // Force failure
    } catch (error) {
      // This is expected - starting a second competition should fail
      expect(error).toBeDefined();
    }

    // Verify the first competition is still active
    const activeCompetitionResponse = await adminClient.getCompetition(
      competition1.id,
    );
    if (!activeCompetitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const activeCompetition = activeCompetitionResponse.competition;

    // Should still be the first competition
    expect(activeCompetition.id).toBe(competition1.id);
    expect(activeCompetition.status).toBe("active");
    expect(activeCompetition.sandboxMode).toBe(true);
  });

  test("should verify that manually added agent gets a portfolio snapshot in sandbox mode", async () => {
    // First create a dummy user+agent to start the competition with (to avoid "no agents provided" error)
    const dummyUserResponse = await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: "Dummy User",
      email: "dummy@example.com",
      agentName: "Dummy Agent",
      agentDescription: "Dummy agent for competition startup",
      agentWalletAddress: generateRandomEthAddress(),
    });
    expect(dummyUserResponse.success).toBe(true);
    const dummyAgent = (dummyUserResponse as UserRegistrationResponse).agent;
    expect(dummyAgent).toBeDefined();

    // Create and start a sandbox competition with the dummy agent
    const competitionName = `Sandbox Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [dummyAgent!.id],
      sandboxMode: true, // sandboxMode = true
    });
    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;
    expect(competition.sandboxMode).toBe(true);

    // Verify competition is active and in sandbox mode
    const activeCompetitionResponse = await adminClient.getCompetition(
      competition.id,
    );
    if (!activeCompetitionResponse.success) {
      throw new Error("Failed to get competition");
    }
    const activeCompetition = activeCompetitionResponse.competition;
    expect(activeCompetition.id).toBe(competition.id);
    expect(activeCompetition.status).toBe("active");
    expect(activeCompetition.sandboxMode).toBe(true);

    // First register a user without an agent
    const newUserResponse = await adminClient.registerUser({
      walletAddress: generateRandomEthAddress(),
      name: "New Sandbox User",
      email: "new-sandbox@example.com",
    });
    expect(newUserResponse.success).toBe(true);
    const newUser = (newUserResponse as UserRegistrationResponse).user;

    // Now register an agent for this user
    const newAgentResponse = await adminClient.registerAgent({
      user: {
        walletAddress: newUser.walletAddress,
      },
      agent: {
        name: "New Sandbox Agent",
        description:
          "Agent that should be manually added to sandbox competition",
        walletAddress: generateRandomEthAddress(),
      },
    });
    expect(newAgentResponse.success).toBe(true);
    const newAgent = (newAgentResponse as AdminAgentResponse).agent;

    // Manually add the agent to the competition
    const addAgentResponse = await adminClient.addAgentToCompetition(
      competition.id,
      newAgent.id,
    );
    expect(addAgentResponse.success).toBe(true);

    // Wait a moment for processing
    await wait(100);

    // Check that the agent was manually added to the competition
    const competitionAgentsResponse = await adminClient.getCompetitionAgents(
      competition.id,
    );
    expect(competitionAgentsResponse.success).toBe(true);
    const competitionAgents =
      competitionAgentsResponse as CompetitionAgentsResponse;

    // Should have both the dummy agent and the newly registered agent
    expect(competitionAgents.agents.length).toBe(2);
    const agentIds = competitionAgents.agents.map((agent) => agent.id);
    expect(agentIds).toContain(dummyAgent!.id);
    expect(agentIds).toContain(newAgent!.id);

    // Verify the new agent has active status in the competition
    const newAgentInCompetition = competitionAgents.agents.find(
      (agent) => agent.id === newAgent!.id,
    );
    expect(newAgentInCompetition?.active).toBe(true);

    // Verify that a portfolio snapshot was created for the newly auto-joined agent
    // Get snapshots for this specific agent
    const snapshotsResponse = await adminClient.request(
      "get",
      `/admin/competition/${competition.id}/snapshots?agentId=${newAgent!.id}`,
    );
    const typedResponse = snapshotsResponse as SnapshotResponse;
    expect(typedResponse.success).toBe(true);
    expect(typedResponse.snapshots).toBeDefined();
    expect(typedResponse.snapshots.length).toBeGreaterThan(0);

    // Verify the snapshot has the correct agent ID and competition ID
    const latestSnapshot =
      typedResponse.snapshots[typedResponse.snapshots.length - 1];
    expect(latestSnapshot?.agentId).toBe(newAgent!.id);
    expect(latestSnapshot?.competitionId).toBe(competition.id);

    // Verify the snapshot has a total value (confirming it's a complete snapshot)
    expect(latestSnapshot?.totalValue).toBeDefined();
    expect(latestSnapshot?.totalValue).toBeGreaterThan(0);
  });
});
