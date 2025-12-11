/**
 * EigenAI RPC Endpoint Tests
 *
 * Tests for the EigenAI verification badge RPC endpoints.
 */
import { beforeEach, describe, expect, test } from "vitest";

import {
  agentBadgeStatus,
  signatureSubmissions,
} from "@recallnet/db/schema/eigenai/defs";
import { CROSS_CHAIN_TRADING_TYPE } from "@recallnet/test-utils";
import { connectToDb } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
} from "@recallnet/test-utils";

import { createTestRpcClient } from "../utils/rpc-client-helpers.js";

/**
 * Helper to insert EigenAI badge status test data directly into the database
 */
async function insertBadgeStatus(
  db: Awaited<ReturnType<typeof connectToDb>>,
  data: {
    agentId: string;
    competitionId: string;
    isBadgeActive: boolean;
    signaturesLast24h: number;
  },
): Promise<void> {
  await db.insert(agentBadgeStatus).values({
    agentId: data.agentId,
    competitionId: data.competitionId,
    isBadgeActive: data.isBadgeActive,
    signaturesLast24h: data.signaturesLast24h,
    lastVerifiedAt: data.isBadgeActive ? new Date() : null,
  });
}

/**
 * Helper to insert a signature submission for testing
 */
async function insertSignatureSubmission(
  db: Awaited<ReturnType<typeof connectToDb>>,
  data: {
    agentId: string;
    competitionId: string;
    verificationStatus: "verified" | "invalid" | "pending";
  },
): Promise<void> {
  await db.insert(signatureSubmissions).values({
    agentId: data.agentId,
    competitionId: data.competitionId,
    signature: "0x" + "a".repeat(130), // Mock 65-byte signature
    chainId: "1",
    requestPrompt: "Test prompt",
    responseModel: "gpt-test",
    responseOutput: "Test output",
    verificationStatus: data.verificationStatus,
    submittedAt: new Date(),
  });
}

describe("EigenAI RPC", () => {
  let adminApiKey: string;
  let rpcClient: Awaited<ReturnType<typeof createTestRpcClient>>;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
    rpcClient = await createTestRpcClient();
  });

  describe("getBulkBadgeStatuses", () => {
    test("should return empty object when competition has no eigenai badges", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create a competition with agents but no EigenAI data
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Without Badge",
      });

      const startResponse = await adminClient.startCompetition({
        name: `No Badge Competition ${Date.now()}`,
        description: "Competition without EigenAI badges",
        agentIds: [agent1.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse.success).toBe(true);

      const competitionId = (
        startResponse as { success: true; competition: { id: string } }
      ).competition.id;

      // Call RPC
      const result = await rpcClient.eigenai.getBulkBadgeStatuses({
        competitionId,
      });

      expect(result).toEqual({});
    });

    test("should return badge statuses for agents with active badges", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition with agents
      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Active Badge",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Without Badge",
      });

      const startResponse = await adminClient.startCompetition({
        name: `Badge Test Competition ${Date.now()}`,
        description: "Competition for badge testing",
        agentIds: [agent1.id, agent2.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse.success).toBe(true);

      const competitionId = (
        startResponse as { success: true; competition: { id: string } }
      ).competition.id;

      // Insert badge status for agent1 only
      const db = await connectToDb();
      await insertBadgeStatus(db, {
        agentId: agent1.id,
        competitionId,
        isBadgeActive: true,
        signaturesLast24h: 15,
      });

      // Call RPC
      const result = await rpcClient.eigenai.getBulkBadgeStatuses({
        competitionId,
      });

      // Should have agent1's badge status
      expect(result[agent1.id]).toBeDefined();
      expect(result[agent1.id]?.isBadgeActive).toBe(true);
      expect(result[agent1.id]?.signaturesLast24h).toBe(15);

      // Should NOT have agent2 (no badge)
      expect(result[agent2.id]).toBeUndefined();
    });

    test("should return inactive badge status when badge is not active", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent With Inactive Badge",
      });

      const startResponse = await adminClient.startCompetition({
        name: `Inactive Badge Competition ${Date.now()}`,
        description: "Competition for inactive badge testing",
        agentIds: [agent.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse.success).toBe(true);

      const competitionId = (
        startResponse as { success: true; competition: { id: string } }
      ).competition.id;

      // Insert inactive badge status
      const db = await connectToDb();
      await insertBadgeStatus(db, {
        agentId: agent.id,
        competitionId,
        isBadgeActive: false,
        signaturesLast24h: 0,
      });

      const result = await rpcClient.eigenai.getBulkBadgeStatuses({
        competitionId,
      });

      expect(result[agent.id]).toBeDefined();
      expect(result[agent.id]?.isBadgeActive).toBe(false);
      expect(result[agent.id]?.signaturesLast24h).toBe(0);
    });
  });

  describe("getCompetitionStats", () => {
    test("should return stats for competition with eigenai participants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent: agent1 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Stats Agent 1",
      });
      const { agent: agent2 } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Stats Agent 2",
      });

      const startResponse = await adminClient.startCompetition({
        name: `Stats Competition ${Date.now()}`,
        description: "Competition for stats testing",
        agentIds: [agent1.id, agent2.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse.success).toBe(true);

      const competitionId = (
        startResponse as { success: true; competition: { id: string } }
      ).competition.id;

      // Insert signature submissions (for totalAgentsWithSubmissions and totalVerifiedSignatures)
      const db = await connectToDb();
      await insertSignatureSubmission(db, {
        agentId: agent1.id,
        competitionId,
        verificationStatus: "verified",
      });
      await insertSignatureSubmission(db, {
        agentId: agent1.id,
        competitionId,
        verificationStatus: "verified",
      });
      await insertSignatureSubmission(db, {
        agentId: agent2.id,
        competitionId,
        verificationStatus: "pending", // Not verified
      });

      // Insert badge statuses (for agentsWithActiveBadge)
      await insertBadgeStatus(db, {
        agentId: agent1.id,
        competitionId,
        isBadgeActive: true,
        signaturesLast24h: 2,
      });
      await insertBadgeStatus(db, {
        agentId: agent2.id,
        competitionId,
        isBadgeActive: false,
        signaturesLast24h: 0,
      });

      const result = await rpcClient.eigenai.getCompetitionStats({
        competitionId,
      });

      // 2 distinct agents have submissions
      expect(result.totalAgentsWithSubmissions).toBe(2);
      // Only agent1 has active badge
      expect(result.agentsWithActiveBadge).toBe(1);
      // Only 2 verified signatures (both from agent1)
      expect(result.totalVerifiedSignatures).toBe(2);
    });

    test("should return zero counts for competition without eigenai participants", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Stats Agent",
      });

      const startResponse = await adminClient.startCompetition({
        name: `Empty Stats Competition ${Date.now()}`,
        description: "Competition without EigenAI",
        agentIds: [agent.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      expect(startResponse.success).toBe(true);

      const competitionId = (
        startResponse as { success: true; competition: { id: string } }
      ).competition.id;

      const result = await rpcClient.eigenai.getCompetitionStats({
        competitionId,
      });

      expect(result.totalAgentsWithSubmissions).toBe(0);
      expect(result.agentsWithActiveBadge).toBe(0);
      expect(result.totalVerifiedSignatures).toBe(0);
    });
  });

  describe("getBadgeStatusesForAgent", () => {
    test("should return empty object when agent has no badges", async () => {
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent No History",
      });

      const result = await rpcClient.eigenai.getBadgeStatusesForAgent({
        agentId: agent.id,
      });

      expect(result).toEqual({});
    });

    test("should return badge statuses across multiple competitions", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Multi-Comp Agent",
      });

      // Create two competitions
      const startResponse1 = await adminClient.startCompetition({
        name: `Agent Comp 1 ${Date.now()}`,
        description: "First competition",
        agentIds: [agent.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });
      const startResponse2 = await adminClient.startCompetition({
        name: `Agent Comp 2 ${Date.now()}`,
        description: "Second competition",
        agentIds: [agent.id],
        tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
      });

      const comp1Id = (
        startResponse1 as { success: true; competition: { id: string } }
      ).competition.id;
      const comp2Id = (
        startResponse2 as { success: true; competition: { id: string } }
      ).competition.id;

      // Insert badge statuses for both competitions
      const db = await connectToDb();
      await insertBadgeStatus(db, {
        agentId: agent.id,
        competitionId: comp1Id,
        isBadgeActive: true,
        signaturesLast24h: 20,
      });
      await insertBadgeStatus(db, {
        agentId: agent.id,
        competitionId: comp2Id,
        isBadgeActive: false,
        signaturesLast24h: 5,
      });

      const result = await rpcClient.eigenai.getBadgeStatusesForAgent({
        agentId: agent.id,
      });

      // Should have statuses for both competitions
      expect(result[comp1Id]).toBeDefined();
      expect(result[comp1Id]?.isBadgeActive).toBe(true);
      expect(result[comp1Id]?.signaturesLast24h).toBe(20);

      expect(result[comp2Id]).toBeDefined();
      expect(result[comp2Id]?.isBadgeActive).toBe(false);
      expect(result[comp2Id]?.signaturesLast24h).toBe(5);
    });
  });
});
