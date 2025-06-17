import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  CompetitionAgentsResponse,
  CompetitionDetailResponse,
  CreateCompetitionResponse,
  ErrorResponse,
  UserVotesResponse,
  VoteResponse,
  VotingStateResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createSiweAuthenticatedClient,
  createTestClient,
  createTestCompetition,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";

describe("Voting API", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);
  });

  describe("POST /api/user/vote", () => {
    test("should successfully cast a vote on pending competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents with their owner SIWE clients
      const { agent: agent1, client: agent1OwnerClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Alpha",
        });
      const { agent: agent2, client: agent2OwnerClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Agent Beta",
        });

      // Create a competition in PENDING state
      const competitionName = `Pending Competition ${Date.now()}`;
      const competitionResponse = await createTestCompetition(
        adminClient,
        competitionName,
      );
      const competition = competitionResponse.competition;

      // Join agents to the competition using their owner's SIWE authentication
      const joinResponse1 = await agent1OwnerClient.joinCompetition(
        competition.id,
        agent1.id,
      );
      expect(joinResponse1.success).toBe(true);

      const joinResponse2 = await agent2OwnerClient.joinCompetition(
        competition.id,
        agent2.id,
      );
      expect(joinResponse2.success).toBe(true);

      // Create SIWE authenticated user for voting (different from agent owners)
      const { client: userClient, user } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Voting User",
        userEmail: "voter@test.com",
      });

      // Cast a vote for agent1
      const voteResponse = await userClient.castVote(agent1.id, competition.id);

      // Verify vote was cast successfully
      expect(voteResponse.success).toBe(true);
      expect((voteResponse as VoteResponse).vote).toBeDefined();
      expect((voteResponse as VoteResponse).vote.userId).toBe(user.id);
      expect((voteResponse as VoteResponse).vote.agentId).toBe(agent1.id);
      expect((voteResponse as VoteResponse).vote.competitionId).toBe(
        competition.id,
      );
    });

    test("should successfully cast a vote on active competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Gamma",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Delta",
      });

      // Start a competition (ACTIVE state)
      const competitionName = `Active Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id, agent2.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient, user } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Active Voter",
        userEmail: "active-voter@test.com",
      });

      // Cast a vote for agent2
      const voteResponse = await userClient.castVote(agent2.id, competition.id);

      // Verify vote was cast successfully
      expect(voteResponse.success).toBe(true);
      expect((voteResponse as VoteResponse).vote).toBeDefined();
      expect((voteResponse as VoteResponse).vote.userId).toBe(user.id);
      expect((voteResponse as VoteResponse).vote.agentId).toBe(agent2.id);
      expect((voteResponse as VoteResponse).vote.competitionId).toBe(
        competition.id,
      );
    });

    test("should prevent duplicate votes (same user, different agents)", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Echo",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Foxtrot",
      });

      // Start a competition
      const competitionName = `Duplicate Vote Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id, agent2.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Duplicate Voter",
        userEmail: "duplicate-voter@test.com",
      });

      // Cast first vote for agent1
      const firstVoteResponse = await userClient.castVote(
        agent1.id,
        competition.id,
      );
      expect(firstVoteResponse.success).toBe(true);

      // Try to cast second vote for agent2 (should fail)
      const secondVoteResponse = await userClient.castVote(
        agent2.id,
        competition.id,
      );

      // Verify second vote was rejected
      expect(secondVoteResponse.success).toBe(false);
      expect((secondVoteResponse as ErrorResponse).error).toContain(
        "already voted",
      );
      expect((secondVoteResponse as ErrorResponse).status).toBe(409);
    });

    test("should allow different users to vote for same agent", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Golf",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Hotel",
      });

      // Start a competition
      const competitionName = `Multi User Vote Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id, agent2.id],
      );
      const competition = competitionResponse.competition;

      // Create first SIWE authenticated user
      const { client: user1Client, user: user1 } =
        await createSiweAuthenticatedClient({
          adminApiKey,
          userName: "Voter One",
          userEmail: "voter1@test.com",
        });

      // Create second SIWE authenticated user
      const { client: user2Client, user: user2 } =
        await createSiweAuthenticatedClient({
          adminApiKey,
          userName: "Voter Two",
          userEmail: "voter2@test.com",
        });

      // Both users vote for the same agent
      const vote1Response = await user1Client.castVote(
        agent1.id,
        competition.id,
      );
      const vote2Response = await user2Client.castVote(
        agent1.id,
        competition.id,
      );

      // Verify both votes were successful
      expect(vote1Response.success).toBe(true);
      expect((vote1Response as VoteResponse).vote.userId).toBe(user1.id);
      expect((vote1Response as VoteResponse).vote.agentId).toBe(agent1.id);

      expect(vote2Response.success).toBe(true);
      expect((vote2Response as VoteResponse).vote.userId).toBe(user2.id);
      expect((vote2Response as VoteResponse).vote.agentId).toBe(agent1.id);
    });

    test("should require authentication", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent India",
      });

      // Start a competition
      const competitionName = `Auth Test Competition ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create unauthenticated client
      const unauthenticatedClient = createTestClient();

      // Try to vote without authentication
      const voteResponse = await unauthenticatedClient.castVote(
        agent1.id,
        competition.id,
      );

      // Verify vote was rejected
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).status).toBe(401);
      // The actual error message is about invalid API key, not authentication
      expect((voteResponse as ErrorResponse).error).toContain(
        "Invalid API key",
      );
    });

    test("should validate agent exists", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register one agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Juliet",
      });

      // Start a competition
      const competitionName = `Invalid Agent Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Invalid Agent Voter",
        userEmail: "invalid-agent-voter@test.com",
      });

      // Try to vote for non-existent agent
      const fakeAgentId = "00000000-0000-0000-0000-000000000000";
      const voteResponse = await userClient.castVote(
        fakeAgentId,
        competition.id,
      );

      // Verify vote was rejected
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).status).toBe(404);
      expect((voteResponse as ErrorResponse).error).toContain(
        "Agent not found",
      );
    });

    test("should validate agent participates in competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Kilo",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Lima",
      });

      // Start a competition with only agent1
      const competitionName = `Participation Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Participation Voter",
        userEmail: "participation-voter@test.com",
      });

      // Try to vote for agent2 who is not in the competition
      const voteResponse = await userClient.castVote(agent2.id, competition.id);

      // Verify vote was rejected
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).status).toBe(400);
      expect((voteResponse as ErrorResponse).error).toContain(
        "does not participate",
      );
    });

    test("should handle invalid request data", async () => {
      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Invalid Data Voter",
        userEmail: "invalid-data-voter@test.com",
      });

      // Try to vote with invalid UUID
      const invalidAgentId = "invalid-uuid";
      const invalidCompetitionId = "also-invalid";
      const voteResponse = await userClient.castVote(
        invalidAgentId,
        invalidCompetitionId,
      );

      // Verify vote was rejected with validation error
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).status).toBe(400);
    });
  });

  describe("GET /api/user/votes/:competitionId/state", () => {
    test("should return correct voting state for pending competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Mike",
      });

      // Create a competition in PENDING state
      const competitionName = `Voting State Test ${Date.now()}`;
      const competitionResponse = await createTestCompetition(
        adminClient,
        competitionName,
      );
      const competition = competitionResponse.competition;

      // Join agent to competition
      await adminClient.joinCompetition(competition.id, agent1.id);

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "State Voter",
        userEmail: "state-voter@test.com",
      });

      // Get voting state
      const stateResponse = await userClient.getVotingState(competition.id);

      // Verify voting state response structure matches actual API response
      expect(stateResponse.success).toBe(true);
      // The actual API response structure has competitionId missing from top level
      expect((stateResponse as VotingStateResponse).votingState).toBeDefined();
      expect((stateResponse as VotingStateResponse).votingState.canVote).toBe(
        true,
      );
      expect(
        (stateResponse as VotingStateResponse).votingState.info.hasVoted,
      ).toBe(false);
    });

    test("should return user vote info when user has voted", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent November",
      });

      // Start a competition
      const competitionName = `Voted State Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Voted State User",
        userEmail: "voted-state-user@test.com",
      });

      // Cast a vote first
      const voteResponse = await userClient.castVote(agent1.id, competition.id);
      expect(voteResponse.success).toBe(true);

      // Get voting state after voting
      const stateResponse = await userClient.getVotingState(competition.id);

      // Verify voting state shows user has voted
      expect(stateResponse.success).toBe(true);
      expect((stateResponse as VotingStateResponse).votingState.canVote).toBe(
        false,
      );
      expect(
        (stateResponse as VotingStateResponse).votingState.info.hasVoted,
      ).toBe(true);
      expect(
        (stateResponse as VotingStateResponse).votingState.info.agentId,
      ).toBe(agent1.id);
      expect(
        (stateResponse as VotingStateResponse).votingState.reason,
      ).toContain("already voted");
    });

    test("should return canVote=false when user already voted", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Oscar",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Papa",
      });

      // Start a competition
      const competitionName = `Cannot Vote Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id, agent2.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Cannot Vote User",
        userEmail: "cannot-vote-user@test.com",
      });

      // Cast a vote first
      await userClient.castVote(agent1.id, competition.id);

      // Get voting state - should show cannot vote anymore
      const stateResponse = await userClient.getVotingState(competition.id);

      expect(stateResponse.success).toBe(true);
      expect((stateResponse as VotingStateResponse).votingState.canVote).toBe(
        false,
      );
      expect(
        (stateResponse as VotingStateResponse).votingState.info.hasVoted,
      ).toBe(true);
    });
  });

  describe("GET /api/user/votes", () => {
    test("should return user's votes", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Quebec",
      });

      // Start a competition
      const competitionName = `Get Votes Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Get Votes User",
        userEmail: "get-votes-user@test.com",
      });

      // Cast a vote
      await userClient.castVote(agent1.id, competition.id);

      // Get user's votes
      const votesResponse = await userClient.getUserVotes();

      // Verify votes response structure matches actual API response
      expect(votesResponse.success).toBe(true);
      // The API response doesn't include userId in getUserVotes endpoint
      expect((votesResponse as UserVotesResponse).votes).toHaveLength(1);

      const vote = (votesResponse as UserVotesResponse).votes[0];
      expect(vote).toBeDefined();
      // Note: API doesn't return userId in vote objects
      expect(vote?.agentId).toBe(agent1.id);
      expect(vote?.competitionId).toBe(competition.id);
    });

    test("should filter votes by competition", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents (use same agent for both competitions to avoid issues)
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Romeo",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Sierra",
      });

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Filter Votes User",
        userEmail: "filter-votes-user@test.com",
      });

      // Start first competition with just agent1
      const competition1Response = await startTestCompetition(
        adminClient,
        `Competition 1 ${Date.now()}`,
        [agent1.id],
      );

      // Cast vote in first competition
      await userClient.castVote(agent1.id, competition1Response.competition.id);

      // End the first competition before starting the second
      await adminClient.endCompetition(competition1Response.competition.id);

      // Start second competition with just agent2
      const competition2Response = await startTestCompetition(
        adminClient,
        `Competition 2 ${Date.now()}`,
        [agent2.id],
      );

      // Cast vote in second competition
      await userClient.castVote(agent2.id, competition2Response.competition.id);

      // Get votes filtered by first competition
      const votesResponse = await userClient.getUserVotes(
        competition1Response.competition.id,
      );

      // Verify only votes from first competition are returned
      expect(votesResponse.success).toBe(true);
      expect((votesResponse as UserVotesResponse).votes).toHaveLength(1);
      const firstVote = (votesResponse as UserVotesResponse).votes[0];
      expect(firstVote).toBeDefined();
      expect(firstVote?.competitionId).toBe(
        competition1Response.competition.id,
      );
      expect(firstVote?.agentId).toBe(agent1.id);
    });
  });

  describe("Vote integration with competitions", () => {
    test("should include vote counts in competition agent response", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Tango",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Uniform",
      });

      // Start a competition
      const competitionName = `Vote Count Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id, agent2.id],
      );
      const competition = competitionResponse.competition;

      // Create multiple users and cast votes
      const { client: user1Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Vote Count User 1",
        userEmail: "vote-count-user1@test.com",
      });
      const { client: user2Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Vote Count User 2",
        userEmail: "vote-count-user2@test.com",
      });
      const { client: user3Client } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Vote Count User 3",
        userEmail: "vote-count-user3@test.com",
      });

      // Cast votes - 2 for agent1, 1 for agent2
      await user1Client.castVote(agent1.id, competition.id);
      await user2Client.castVote(agent1.id, competition.id);
      await user3Client.castVote(agent2.id, competition.id);

      // Get competition agents and verify vote counts are included
      const agentsResponse = await adminClient.getCompetitionAgents(
        competition.id,
      );

      expect(agentsResponse.success).toBe(true);
      const agents = (agentsResponse as CompetitionAgentsResponse).agents;
      expect(agents).toHaveLength(2);

      // Find agents and verify vote counts
      const returnedAgent1 = agents.find((a) => a.id === agent1.id);
      const returnedAgent2 = agents.find((a) => a.id === agent2.id);

      expect(returnedAgent1).toBeDefined();
      expect(returnedAgent1?.voteCount).toBe(2);

      expect(returnedAgent2).toBeDefined();
      expect(returnedAgent2?.voteCount).toBe(1);
    });

    test("should include user vote status when authenticated in competition details", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Victor",
      });

      // Start a competition
      const competitionName = `User Vote Status Test ${Date.now()}`;
      const competitionResponse = await startTestCompetition(
        adminClient,
        competitionName,
        [agent1.id],
      );
      const competition = competitionResponse.competition;

      // Create SIWE authenticated user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Vote Status User",
        userEmail: "vote-status-user@test.com",
      });

      // Cast a vote
      await userClient.castVote(agent1.id, competition.id);

      // Get competition details and verify vote status is included
      const competitionDetailsResponse = await userClient.getCompetition(
        competition.id,
      );

      expect(competitionDetailsResponse.success).toBe(true);
      const competitionDetails = (
        competitionDetailsResponse as CompetitionDetailResponse
      ).competition;

      // Verify vote-related fields are present
      expect(competitionDetails.votingEnabled).toBeDefined();
      expect(competitionDetails.stats?.totalVotes).toBeDefined();
      expect(competitionDetails.userVotingInfo).toBeDefined();

      // Verify user has voted
      expect(competitionDetails.userVotingInfo?.canVote).toBe(false);
      expect(competitionDetails.userVotingInfo?.info.hasVoted).toBe(true);
      expect(competitionDetails.userVotingInfo?.info.agentId).toBe(agent1.id);
    });
  });

  describe("Voting date restrictions", () => {
    test("should prevent voting before voting start date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Future Vote",
      });

      // Create competition with voting start date in the future
      const now = new Date();
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      const competitionName = `Future Voting Test ${Date.now()}`;

      const createResponse = await adminClient.createCompetition(
        competitionName,
        "Test competition with future voting date",
        "disallowAll",
        undefined, // externalUrl
        undefined, // imageUrl
        "trading", // type
        futureDate.toISOString(), // votingStartDate
        undefined, // votingEndDate
      );

      expect(createResponse.success).toBe(true);
      const competition = (createResponse as CreateCompetitionResponse)
        .competition;

      // Add agent to competition
      await adminClient.startExistingCompetition(competition.id, [agent1.id]);

      // Create user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Future Vote User",
        userEmail: "future-vote@test.com",
      });

      // Try to vote - should fail
      const voteResponse = await userClient.castVote(agent1.id, competition.id);
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).error).toContain(
        "Voting has not started yet",
      );
    });

    test("should prevent voting after voting end date", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Past Vote",
      });

      // Create competition with voting end date in the past
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      const competitionName = `Past Voting Test ${Date.now()}`;

      const createResponse = await adminClient.createCompetition(
        competitionName,
        "Test competition with past voting date",
        "disallowAll",
        undefined, // externalUrl
        undefined, // imageUrl
        "trading", // type
        undefined, // votingStartDate
        pastDate.toISOString(), // votingEndDate
      );

      expect(createResponse.success).toBe(true);
      const competition = (createResponse as CreateCompetitionResponse)
        .competition;

      // Add agent to competition
      await adminClient.startExistingCompetition(competition.id, [agent1.id]);

      // Create user
      const { client: userClient } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Past Vote User",
        userEmail: "past-vote@test.com",
      });

      // Try to vote - should fail
      const voteResponse = await userClient.castVote(agent1.id, competition.id);
      expect(voteResponse.success).toBe(false);
      expect((voteResponse as ErrorResponse).error).toContain(
        "Voting has ended",
      );
    });

    test("should allow voting within voting date range", async () => {
      // Setup admin client
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Valid Vote",
      });

      // Create competition with voting dates that include now
      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const competitionName = `Valid Voting Test ${Date.now()}`;

      const createResponse = await adminClient.createCompetition(
        competitionName,
        "Test competition with valid voting date range",
        "disallowAll",
        undefined, // externalUrl
        undefined, // imageUrl
        "trading", // type
        startDate.toISOString(), // votingStartDate
        endDate.toISOString(), // votingEndDate
      );

      expect(createResponse.success).toBe(true);
      const competition = (createResponse as CreateCompetitionResponse)
        .competition;

      // Add agent to competition
      await adminClient.startExistingCompetition(competition.id, [agent1.id]);

      // Create user
      const { client: userClient, user } = await createSiweAuthenticatedClient({
        adminApiKey,
        userName: "Valid Vote User",
        userEmail: "valid-vote@test.com",
      });

      // Vote should succeed
      const voteResponse = await userClient.castVote(agent1.id, competition.id);
      expect(voteResponse.success).toBe(true);
      expect((voteResponse as VoteResponse).vote).toBeDefined();
      expect((voteResponse as VoteResponse).vote.userId).toBe(user.id);
      expect((voteResponse as VoteResponse).vote.agentId).toBe(agent1.id);
      expect((voteResponse as VoteResponse).vote.competitionId).toBe(
        competition.id,
      );
    });
  });
});
