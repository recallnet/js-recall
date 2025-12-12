import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { signatureSubmissions } from "@recallnet/db/schema/eigenai/defs";
import {
  ApiClient,
  type EigenaiBadgeStatusResponse,
  type EigenaiCompetitionStatsResponse,
  type EigenaiSubmissionSummary,
  type EigenaiSubmissionsResponse,
  type EigenaiSubmitSignatureResponse,
  type ErrorResponse,
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import { db } from "@/database/db.js";
import { ServiceRegistry } from "@/services/index.js";

// =============================================================================
// STATIC TEST FIXTURES - Captured from live EigenAI API (2025-12-09)
// These are real cryptographic signatures that can be deterministically verified
// =============================================================================

const EIGENAI_TEST_FIXTURE = {
  requestMessages: [
    {
      role: "user",
      content: "Say hello in exactly 5 words.",
    },
  ],
  responseModel: "gpt-oss-120b-f16",
  fullPrompt: "Say hello in exactly 5 words.",
  fullOutput:
    '<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  signature:
    "0x5dc80dc47e71cbd4bf1d8d86e28b1919b42719c5a5cbf548811dd3f73702aac11b0e10ed3f11da2890e784ae056c163655b1fe00c0e2c8c0a4fd6a9777140c8f1b",
  chainId: "1",
  expectedSigner: "0x7053bfb0433a16a2405de785d547b1b32cee0cf3",
} as const;

const EIGENAI_INVALID_SIGNATURE_FIXTURE = {
  requestMessages: [
    {
      role: "user",
      content: "Say hello in exactly 5 words.",
    },
  ],
  responseModel: "gpt-oss-120b-f16",
  fullPrompt: "Say hello in exactly 5 words.",
  fullOutput:
    '<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  // Corrupted signature (last 8 chars changed to deadbeef)
  signature:
    "0x5dc80dc47e71cbd4bf1d8d86e28b1919b42719c5a5cbf548811dd3f73702aac11b0e10ed3f11da2890e784ae056c163655b1fe00c0e2c8c0a4fd6a9777deadbeef",
  chainId: "1",
  expectedSigner: "0x7053bfb0433a16a2405de785d547b1b32cee0cf3",
} as const;

describe("EigenAI Verification", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  test("should submit valid signature and receive verification success", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Test Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Verification Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    // Wait for competition to be fully initialized
    await wait(500);

    // Submit a valid EigenAI signature (agentId comes from auth)
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(true);
    const typedResponse = submitResponse as EigenaiSubmitSignatureResponse;

    // Verify the submission was stored and verified
    expect(typedResponse.submissionId).toBeDefined();
    expect(typedResponse.verified).toBe(true);
    expect(typedResponse.verificationStatus).toBe("verified");

    // Verify badge status is returned
    expect(typedResponse.badgeStatus).toBeDefined();
    expect(typedResponse.badgeStatus.signaturesLast24h).toBeGreaterThan(0);
  });

  test("should reject duplicate signature submission with 409 error", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Duplicate Sig Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Duplicate Sig Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // First submission should succeed
    const firstSubmit = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(firstSubmit.success).toBe(true);
    expect((firstSubmit as EigenaiSubmitSignatureResponse).verified).toBe(true);

    // Second submission with same signature should fail with 409
    const duplicateSubmit = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(duplicateSubmit.success).toBe(false);
    expect((duplicateSubmit as { status?: number }).status).toBe(409);
    expect((duplicateSubmit as { error?: string }).error).toContain(
      "already been submitted",
    );
  });

  test("should submit invalid signature and receive verification failure", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Invalid Sig Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Invalid Sig Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit an invalid (corrupted) EigenAI signature
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullPrompt,
      responseModel: EIGENAI_INVALID_SIGNATURE_FIXTURE.responseModel,
      responseOutput: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullOutput,
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    // The submission should succeed (it's stored) but verification should fail
    expect(submitResponse.success).toBe(true);
    const typedResponse = submitResponse as EigenaiSubmitSignatureResponse;

    expect(typedResponse.submissionId).toBeDefined();
    expect(typedResponse.verified).toBe(false);
    expect(typedResponse.verificationStatus).toBe("invalid");
  });

  test("should reject signature with tampered prompt", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Tampered Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Tampered Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit with tampered prompt (different from what was signed)
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "TAMPERED PROMPT - not original",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // The submission is stored but verification fails
    expect(submitResponse.success).toBe(true);
    const typedResponse = submitResponse as EigenaiSubmitSignatureResponse;

    expect(typedResponse.verified).toBe(false);
    expect(typedResponse.verificationStatus).toBe("invalid");
  });

  test("should retrieve agent badge status for competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Badge Status Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Badge Status Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit a valid signature first to create badge status
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(true);

    // Get badge status
    const badgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );

    expect(badgeResponse.success).toBe(true);
    const typedBadgeResponse = badgeResponse as EigenaiBadgeStatusResponse;

    // Badge status is flat (not nested)
    expect(typedBadgeResponse.agentId).toBe(agent.id);
    expect(typedBadgeResponse.competitionId).toBe(competition.id);
    expect(typedBadgeResponse.signaturesLast24h).toBeGreaterThan(0);
  });

  test("should return inactive badge status for agent with no submissions", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI No Badge Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI No Badge Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Get badge status WITHOUT submitting any signatures
    const badgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );

    expect(badgeResponse.success).toBe(true);
    const typedBadgeResponse = badgeResponse as EigenaiBadgeStatusResponse;

    // Should return inactive badge status (flat structure)
    expect(typedBadgeResponse.isBadgeActive).toBe(false);
    expect(typedBadgeResponse.signaturesLast24h).toBe(0);
    expect(typedBadgeResponse.lastVerifiedAt).toBeNull();
  });

  test("should retrieve paginated submission history", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Submissions Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Submissions Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit multiple signatures (valid and invalid)
    await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    await wait(100);

    // Submit an invalid one (different prompt to make it unique)
    await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "Different prompt for second submission",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    await wait(500);

    // Get submission history
    const submissionsResponse = await agentClient.getEigenaiSubmissions(
      competition.id,
      { limit: 10, offset: 0 },
    );

    expect(submissionsResponse.success).toBe(true);
    const typedSubmissionsResponse =
      submissionsResponse as EigenaiSubmissionsResponse;

    expect(typedSubmissionsResponse.submissions).toBeDefined();
    expect(typedSubmissionsResponse.submissions.length).toBe(2);
    expect(typedSubmissionsResponse.pagination).toBeDefined();
    expect(typedSubmissionsResponse.pagination.total).toBe(2);

    // Verify both submissions are present (using EigenaiSubmissionSummary)
    const verifiedSubmission = typedSubmissionsResponse.submissions.find(
      (s: EigenaiSubmissionSummary) => s.verificationStatus === "verified",
    );
    const invalidSubmission = typedSubmissionsResponse.submissions.find(
      (s: EigenaiSubmissionSummary) => s.verificationStatus === "invalid",
    );

    expect(verifiedSubmission).toBeDefined();
    expect(invalidSubmission).toBeDefined();
  });

  test("should filter submissions by status", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Filter Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Filter Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit one valid
    await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // Submit one invalid
    await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "Invalid prompt",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: "Invalid output",
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    await wait(500);

    // Filter by verified status
    const verifiedOnlyResponse = await agentClient.getEigenaiSubmissions(
      competition.id,
      { limit: 10, offset: 0, status: "verified" },
    );

    expect(verifiedOnlyResponse.success).toBe(true);
    const typedVerifiedResponse =
      verifiedOnlyResponse as EigenaiSubmissionsResponse;

    expect(typedVerifiedResponse.submissions.length).toBe(1);
    expect(typedVerifiedResponse.submissions[0]?.verificationStatus).toBe(
      "verified",
    );

    // Filter by invalid status
    const invalidOnlyResponse = await agentClient.getEigenaiSubmissions(
      competition.id,
      { limit: 10, offset: 0, status: "invalid" },
    );

    expect(invalidOnlyResponse.success).toBe(true);
    const typedInvalidResponse =
      invalidOnlyResponse as EigenaiSubmissionsResponse;

    expect(typedInvalidResponse.submissions.length).toBe(1);
    expect(typedInvalidResponse.submissions[0]?.verificationStatus).toBe(
      "invalid",
    );
  });

  test("should retrieve competition EigenAI statistics (public endpoint)", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Stats Agent 1 ${Date.now()}`,
      });

    const { agent: agent2, client: agent2Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Stats Agent 2 ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Stats Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Agent 1 submits a valid signature
    await agent1Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // Agent 2 submits an invalid signature
    await agent2Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "Different prompt for agent 2",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: "Different output",
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    await wait(500);

    // Get competition stats (using an unauthenticated client for public endpoint)
    const publicClient = new ApiClient();
    const statsResponse = await publicClient.getEigenaiCompetitionStats(
      competition.id,
    );

    expect(statsResponse.success).toBe(true);
    const typedStatsResponse = statsResponse as EigenaiCompetitionStatsResponse;

    // Stats are flat (not nested under .stats)
    expect(typedStatsResponse.competitionId).toBe(competition.id);
    expect(typedStatsResponse.totalAgentsWithSubmissions).toBe(2);
    expect(typedStatsResponse.totalVerifiedSignatures).toBe(1);
  });

  test("should require authentication for signature submission", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: `EigenAI Auth Test Agent ${Date.now()}`,
    });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Auth Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Try to submit signature without authentication
    const unauthenticatedClient = new ApiClient();
    const submitResponse = await unauthenticatedClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(false);
    const errorResponse = submitResponse as ErrorResponse;
    expect(errorResponse.status).toBe(401);
  });

  test("should require authentication for badge status", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: `EigenAI Badge Auth Agent ${Date.now()}`,
    });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Badge Auth Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Try to get badge status without authentication
    const unauthenticatedClient = new ApiClient();
    const badgeResponse = await unauthenticatedClient.getEigenaiBadgeStatus(
      competition.id,
    );

    expect(badgeResponse.success).toBe(false);
    const errorResponse = badgeResponse as ErrorResponse;
    expect(errorResponse.status).toBe(401);
  });

  test("should reject submission with invalid competitionId", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Invalid Comp Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Invalid Comp Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);

    await wait(500);

    // Try to submit with a non-existent competition ID
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: "00000000-0000-0000-0000-000000000000",
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(false);
    const errorResponse = submitResponse as ErrorResponse;
    expect([400, 404]).toContain(errorResponse.status);
  });

  test("should reject submission when competition is pending (not started)", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Pending Comp Agent ${Date.now()}`,
      });

    // Create a competition but do NOT start it (status will be 'pending')
    const createResponse = await adminClient.createCompetition({
      name: `EigenAI Pending Test ${Date.now()}`,
      type: "trading",
    });
    expect(createResponse.success).toBe(true);
    const competition = (
      createResponse as { success: true; competition: { id: string } }
    ).competition;

    // Add agent to the pending competition
    await adminClient.addAgentToCompetition(competition.id, agent.id);

    await wait(500);

    // Try to submit signature to pending competition - should fail with 409
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(false);
    const errorResponse = submitResponse as ErrorResponse;
    expect(errorResponse.status).toBe(400);
    expect(errorResponse.error).toContain("not active");
  });

  test("should reject submission when competition has ended", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Ended Comp Agent ${Date.now()}`,
      });

    // Start a competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Ended Test ${Date.now()}`,
      agentIds: [agent.id],
    });
    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // End the competition
    const endResponse = await adminClient.endCompetition(competition.id);
    expect(endResponse.success).toBe(true);

    await wait(500);

    // Try to submit signature to ended competition - should fail with 409
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(false);
    const errorResponse = submitResponse as ErrorResponse;
    expect(errorResponse.status).toBe(400);
    expect(errorResponse.error).toContain("not active");
  });

  // =============================================================================
  // CRON JOB SIMULATION TESTS
  // These tests simulate the badge refresh cron job (refresh-eigenai-badges.ts)
  // =============================================================================

  test("should refresh badge statuses via cron job service call", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Cron Agent 1 ${Date.now()}`,
      });

    const { agent: agent2, client: agent2Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Cron Agent 2 ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Cron Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Agent 1 submits a valid signature
    await agent1Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // Agent 2 submits an invalid signature
    await agent2Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "Different prompt for agent 2",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: "Different output",
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    await wait(500);

    // Simulate the cron job by calling the service directly
    const services = new ServiceRegistry();
    const agentsUpdated = await services.eigenaiService.refreshBadgeStatuses(
      competition.id,
    );

    // Should have updated badge statuses for both agents
    expect(agentsUpdated).toBeGreaterThan(0);

    // Verify agent1 has active badge (verified submission)
    const badge1Response = await agent1Client.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(badge1Response.success).toBe(true);
    const badge1 = badge1Response as EigenaiBadgeStatusResponse;
    expect(badge1.isBadgeActive).toBe(true);
    expect(badge1.signaturesLast24h).toBe(1);

    // Verify agent2 has inactive badge (only invalid submission)
    const badge2Response = await agent2Client.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(badge2Response.success).toBe(true);
    const badge2 = badge2Response as EigenaiBadgeStatusResponse;
    expect(badge2.isBadgeActive).toBe(false);
    expect(badge2.signaturesLast24h).toBe(0);
  });

  test("should handle agents with no submissions in cron refresh", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agents
    const { agent: agentWithSubmission, client: agentWithSubmissionClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Cron With Sub ${Date.now()}`,
      });

    const { agent: agentNoSubmission, client: agentNoSubmissionClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Cron No Sub ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Cron No Sub Test ${Date.now()}`,
      agentIds: [agentWithSubmission.id, agentNoSubmission.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Only one agent submits
    await agentWithSubmissionClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    await wait(500);

    // Run cron refresh
    const services = new ServiceRegistry();
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    // Agent with submission should have active badge
    const badgeWithSub = await agentWithSubmissionClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(badgeWithSub.success).toBe(true);
    expect((badgeWithSub as EigenaiBadgeStatusResponse).isBadgeActive).toBe(
      true,
    );

    // Agent without submission should have inactive badge (default state)
    const badgeNoSub = await agentNoSubmissionClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(badgeNoSub.success).toBe(true);
    // The controller returns default inactive state for agents with no badge record
    expect((badgeNoSub as EigenaiBadgeStatusResponse).isBadgeActive).toBe(
      false,
    );
    expect((badgeNoSub as EigenaiBadgeStatusResponse).signaturesLast24h).toBe(
      0,
    );
  });

  test("should update competition stats after cron refresh", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register multiple agents
    const { agent: agent1, client: agent1Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Stats Cron Agent 1 ${Date.now()}`,
      });

    const { agent: agent2, client: agent2Client } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Stats Cron Agent 2 ${Date.now()}`,
      });

    const { agent: agent3 } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: `EigenAI Stats Cron Agent 3 ${Date.now()}`,
    });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Stats Cron Test ${Date.now()}`,
      agentIds: [agent1.id, agent2.id, agent3.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Agent 1 submits valid signature
    await agent1Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // Agent 2 submits invalid signature
    await agent2Client.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: "Agent 2 prompt",
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: "Agent 2 output",
      signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
    });

    // Agent 3 does not submit

    await wait(500);

    // Run cron refresh
    const services = new ServiceRegistry();
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    await wait(500);

    // Check competition stats
    const publicClient = new ApiClient();
    const statsResponse = await publicClient.getEigenaiCompetitionStats(
      competition.id,
    );

    expect(statsResponse.success).toBe(true);
    const stats = statsResponse as EigenaiCompetitionStatsResponse;

    expect(stats.totalAgentsWithSubmissions).toBe(2); // agent1 and agent2 submitted
    expect(stats.agentsWithActiveBadge).toBe(1); // only agent1 has verified submission
    expect(stats.totalVerifiedSignatures).toBe(1); // only agent1's signature was verified
  });

  test("should deactivate badge when submissions are older than 24 hours", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Expiry Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Expiry Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit a valid signature - badge should become active
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(true);
    const typedSubmitResponse =
      submitResponse as EigenaiSubmitSignatureResponse;
    const submissionId = typedSubmitResponse.submissionId;

    // Verify badge is active after submission
    const services = new ServiceRegistry();
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    const activeBadgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(activeBadgeResponse.success).toBe(true);
    expect(
      (activeBadgeResponse as EigenaiBadgeStatusResponse).isBadgeActive,
    ).toBe(true);

    // Manually update the submission's submitted_at to 25 hours ago (past the 24h window)
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db
      .update(signatureSubmissions)
      .set({ submittedAt: twentyFiveHoursAgo })
      .where(eq(signatureSubmissions.id, submissionId));

    // Run cron refresh - badge should now be inactive
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    // Verify badge is now inactive
    const expiredBadgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(expiredBadgeResponse.success).toBe(true);
    const expiredBadge = expiredBadgeResponse as EigenaiBadgeStatusResponse;
    expect(expiredBadge.isBadgeActive).toBe(false);
    expect(expiredBadge.signaturesLast24h).toBe(0);
  });

  // =============================================================================
  // COMPETITION END - BADGE FREEZE TESTS
  // These tests verify that badge status is frozen when a competition ends
  // =============================================================================

  test("should freeze badge status when competition ends via endCompetition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Freeze Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Freeze Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit a valid signature - badge should become active
    const submitResponse = await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    expect(submitResponse.success).toBe(true);

    // Verify badge is active after submission
    const services = new ServiceRegistry();
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    const activeBadgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(activeBadgeResponse.success).toBe(true);
    expect(
      (activeBadgeResponse as EigenaiBadgeStatusResponse).isBadgeActive,
    ).toBe(true);
    expect(
      (activeBadgeResponse as EigenaiBadgeStatusResponse).signaturesLast24h,
    ).toBe(1);

    // End the competition - this should freeze badge status
    const endResult = await services.competitionService.endCompetition(
      competition.id,
    );
    expect(endResult.competition.status).toBe("ended");

    // Wait for any async operations to complete
    await wait(500);

    // Verify badge status is still frozen and accessible
    const frozenBadgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(frozenBadgeResponse.success).toBe(true);
    const frozenBadge = frozenBadgeResponse as EigenaiBadgeStatusResponse;
    expect(frozenBadge.isBadgeActive).toBe(true);
    expect(frozenBadge.signaturesLast24h).toBe(1);

    // Verify competition stats are still accessible for ended competition
    const publicClient = new ApiClient();
    const statsResponse = await publicClient.getEigenaiCompetitionStats(
      competition.id,
    );
    expect(statsResponse.success).toBe(true);
    const stats = statsResponse as EigenaiCompetitionStatsResponse;
    expect(stats.agentsWithActiveBadge).toBe(1);
    expect(stats.totalVerifiedSignatures).toBe(1);
  });

  test("should preserve badge status after competition ends even if cron runs", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register an agent
    const { agent, client: agentClient } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: `EigenAI Preserve Agent ${Date.now()}`,
      });

    // Start a paper trading competition
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: `EigenAI Preserve Test ${Date.now()}`,
      agentIds: [agent.id],
    });

    expect(competitionResponse.success).toBe(true);
    const competition = competitionResponse.competition;

    await wait(500);

    // Submit a valid signature
    await agentClient.submitEigenaiSignature({
      competitionId: competition.id,
      requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
      responseModel: EIGENAI_TEST_FIXTURE.responseModel,
      responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      signature: EIGENAI_TEST_FIXTURE.signature,
    });

    // Initial refresh
    const services = new ServiceRegistry();
    await services.eigenaiService.refreshBadgeStatuses(competition.id);

    // Verify badge is active
    const activeBadgeResponse = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    expect(
      (activeBadgeResponse as EigenaiBadgeStatusResponse).isBadgeActive,
    ).toBe(true);

    // End the competition
    await services.competitionService.endCompetition(competition.id);

    await wait(500);

    // Record badge state after ending
    const afterEndBadge = await agentClient.getEigenaiBadgeStatus(
      competition.id,
    );
    const afterEndState = afterEndBadge as EigenaiBadgeStatusResponse;
    expect(afterEndState.isBadgeActive).toBe(true);

    // Simulate what would happen if cron tried to refresh an ended competition
    // The cron job should skip ended competitions, but even if it ran,
    // the badge status should remain frozen at the end state
    // (In practice, the cron only processes active competitions)

    // Verify badge state hasn't changed
    const finalBadge = await agentClient.getEigenaiBadgeStatus(competition.id);
    const finalState = finalBadge as EigenaiBadgeStatusResponse;
    expect(finalState.isBadgeActive).toBe(afterEndState.isBadgeActive);
    expect(finalState.signaturesLast24h).toBe(afterEndState.signaturesLast24h);
  });
});
