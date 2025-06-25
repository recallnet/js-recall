import axios from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import config from "@/config/index.js";

import { ApiClient } from "../utils/api-client.js";
import { BlockchainType } from "../utils/api-types.js";
import { getBaseUrl } from "../utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "../utils/test-helpers.js";

describe("Object Index Tests", () => {
  let adminClient: ApiClient;
  let agentClient: ApiClient;
  let adminApiKey: string;
  let agentId: string;
  let competitionId: string;

  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly using the setup endpoint
    const adminResponse = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });
    adminApiKey = adminResponse.data.admin.apiKey;
    adminClient = new ApiClient(adminApiKey);

    // Set up user and agent
    const setup = await registerUserAndAgentAndGetClient({ adminApiKey });
    agentClient = setup.client;
    agentId = setup.agent.id;

    // Create and start a test competition
    const competition = await startTestCompetition(
      adminClient,
      "Test Competition for Object Index",
      [agentId],
    );
    competitionId = competition.competition.id;
  });

  afterEach(async () => {
    await cleanupTestState();
  });

  describe("Object Index sync", () => {
    it("should populate object_index entries when manually synced after competition ends", async () => {
      // Make some trades
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      const tradeResponse1 = await agentClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "100",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Test trade 1",
      });

      if ("error" in tradeResponse1) {
        throw new Error(`Trade failed: ${tradeResponse1.error}`);
      }

      const tradeResponse2 = await agentClient.executeTrade({
        fromToken: solTokenAddress,
        toToken: usdcTokenAddress,
        amount: "0.1",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Test trade 2",
      });

      if ("error" in tradeResponse2) {
        throw new Error(`Trade failed: ${tradeResponse2.error}`);
      }

      // End the competition
      const endResponse = await adminClient.endCompetition(competitionId);
      if ("error" in endResponse) {
        throw new Error(`Failed to end competition: ${endResponse.error}`);
      }

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Manually sync object index after competition ends
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
      });

      if ("error" in syncResponse) {
        throw new Error(`Failed to sync object index: ${syncResponse.error}`);
      }

      // Check object_index entries
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId,
        limit: 100,
      });

      if ("error" in objectIndexResponse) {
        throw new Error(
          `Failed to get object index: ${objectIndexResponse.error}`,
        );
      }

      // Verify we have entries
      expect(objectIndexResponse.success).toBe(true);
      expect(objectIndexResponse.data.entries.length).toBeGreaterThan(0);

      // Check for different data types
      const dataTypes = new Set(
        objectIndexResponse.data.entries.map((e) => e.dataType),
      );

      // Should have at least trades
      expect(dataTypes.has("trade")).toBe(true);

      // Verify trade entries
      const tradeEntries = objectIndexResponse.data.entries.filter(
        (e) => e.dataType === "trade",
      );
      expect(tradeEntries.length).toBeGreaterThanOrEqual(2); // We made 2 trades

      // Verify trade data structure
      for (const entry of tradeEntries) {
        expect(entry.competitionId).toBe(competitionId);
        expect(entry.agentId).toBe(agentId);
        expect(entry.dataType).toBe("trade");
        expect(entry.data).toBeTruthy();
        expect(entry.sizeBytes).toBeGreaterThan(0);
        expect(entry.metadata).toBeTruthy();

        // Parse and verify trade data
        const tradeData = JSON.parse(entry.data);
        expect(tradeData).toHaveProperty("id");
        expect(tradeData).toHaveProperty("fromToken");
        expect(tradeData).toHaveProperty("toToken");
        expect(tradeData).toHaveProperty("fromAmount");
      }
    });
  });

  describe("Manual sync route", () => {
    it("should sync object_index entries via manual sync endpoint", async () => {
      // Make a trade
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      const tradeResponse = await agentClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "50",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Test trade for sync",
      });

      if ("error" in tradeResponse) {
        throw new Error(`Trade failed: ${tradeResponse.error}`);
      }

      // Wait a bit for trade to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Manually trigger sync for specific data types
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["trade"],
      });

      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }

      expect(syncResponse.success).toBe(true);
      expect(syncResponse.dataTypes).toContain("trade");

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the data was synced
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade",
      });

      if ("error" in objectIndexResponse) {
        throw new Error(
          `Failed to get object index: ${objectIndexResponse.error}`,
        );
      }

      expect(objectIndexResponse.success).toBe(true);
      expect(objectIndexResponse.data.entries.length).toBeGreaterThanOrEqual(1);

      // Verify the synced trade
      const syncedTrade = objectIndexResponse.data.entries[0];
      if (syncedTrade) {
        expect(syncedTrade.dataType).toBe("trade");
        expect(syncedTrade.competitionId).toBe(competitionId);
        expect(syncedTrade.agentId).toBe(agentId);
      }
    });

    it("should sync all data types when no specific types provided", async () => {
      // Make some activity
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      const tradeResponse = await agentClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "25",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Test trade for full sync",
      });

      if ("error" in tradeResponse) {
        throw new Error(`Trade failed: ${tradeResponse.error}`);
      }

      // Wait a bit for trade to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Sync without specifying data types (should use defaults)
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
      });

      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }

      expect(syncResponse.success).toBe(true);
      expect(syncResponse.dataTypes.length).toBeGreaterThan(0);

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check what was synced
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId,
      });

      if ("error" in objectIndexResponse) {
        throw new Error(
          `Failed to get object index: ${objectIndexResponse.error}`,
        );
      }

      expect(objectIndexResponse.success).toBe(true);
      expect(objectIndexResponse.data.entries.length).toBeGreaterThan(0);
    });

    it("should handle pagination correctly", async () => {
      // Create multiple trades
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      for (let i = 0; i < 5; i++) {
        const tradeResponse = await agentClient.executeTrade({
          fromToken: usdcTokenAddress,
          toToken: solTokenAddress,
          amount: String(10 + i),
          fromChain: BlockchainType.SVM,
          toChain: BlockchainType.SVM,
          reason: `Test trade ${i}`,
        });

        if ("error" in tradeResponse) {
          throw new Error(`Trade ${i} failed: ${tradeResponse.error}`);
        }
      }

      // Wait for trades to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Sync the trades
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["trade"],
      });

      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Test pagination
      const page1 = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade",
        limit: 2,
        offset: 0,
      });

      if ("error" in page1) {
        throw new Error(`Failed to get page 1: ${page1.error}`);
      }

      const page2 = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade",
        limit: 2,
        offset: 2,
      });

      if ("error" in page2) {
        throw new Error(`Failed to get page 2: ${page2.error}`);
      }

      expect(page1.data.entries.length).toBe(2);
      expect(page2.data.entries.length).toBe(2);
      expect(page1.data.pagination.total).toBeGreaterThanOrEqual(5);
      expect(page2.data.pagination.total).toBeGreaterThanOrEqual(5);

      // Ensure different entries
      const page1Ids = page1.data.entries.map((e) => e.id);
      const page2Ids = page2.data.entries.map((e) => e.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it("should filter by agent correctly", async () => {
      // Register another user and agent
      const setup2 = await registerUserAndAgentAndGetClient({ adminApiKey });
      const agent2Client = setup2.client;
      const agent2Id = setup2.agent.id;

      // End the existing competition first
      const endResponse = await adminClient.endCompetition(competitionId);
      if ("error" in endResponse) {
        console.error("Failed to end existing competition:", endResponse.error);
      }

      // Wait a bit for the competition to be fully ended
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create a new competition with both agents
      const newCompetition = await startTestCompetition(
        adminClient,
        "Test Competition for Multiple Agents",
        [agentId, agent2Id],
      );
      const newCompetitionId = newCompetition.competition.id;

      // Make trades with both agents
      const usdcTokenAddress = config.specificChainTokens.svm.usdc;
      const solTokenAddress = config.specificChainTokens.svm.sol;

      await agentClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "100",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Agent 1 trade",
      });

      await agent2Client.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: solTokenAddress,
        amount: "200",
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Agent 2 trade",
      });

      // Wait for trades to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Sync trades
      const syncResp = await adminClient.syncObjectIndex({
        competitionId: newCompetitionId,
        dataTypes: ["trade"],
      });

      if ("error" in syncResp) {
        throw new Error(`Sync failed: ${syncResp.error}`);
      }

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Filter by first agent
      const agent1Entries = await adminClient.getObjectIndex({
        competitionId: newCompetitionId,
        agentId,
        dataType: "trade",
      });

      if ("error" in agent1Entries) {
        throw new Error(
          `Failed to get agent 1 entries: ${agent1Entries.error}`,
        );
      }

      // Filter by second agent
      const agent2Entries = await adminClient.getObjectIndex({
        competitionId: newCompetitionId,
        agentId: agent2Id,
        dataType: "trade",
      });

      if ("error" in agent2Entries) {
        throw new Error(
          `Failed to get agent 2 entries: ${agent2Entries.error}`,
        );
      }

      // Verify filtering works
      expect(
        agent1Entries.data.entries.every((e) => e.agentId === agentId),
      ).toBe(true);
      expect(
        agent2Entries.data.entries.every((e) => e.agentId === agent2Id),
      ).toBe(true);
      expect(agent1Entries.data.entries.length).toBeGreaterThanOrEqual(1);
      expect(agent2Entries.data.entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error handling", () => {
    it("should require admin authentication", async () => {
      const nonAdminClient = new ApiClient("invalid-api-key");

      const syncResponse = await nonAdminClient.syncObjectIndex({
        competitionId,
      });

      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(401);
      }

      const getResponse = await nonAdminClient.getObjectIndex({
        competitionId,
      });

      expect("error" in getResponse).toBe(true);
      if ("error" in getResponse) {
        expect(getResponse.status).toBe(401);
      }
    });

    it("should validate data types", async () => {
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["invalid_type"],
      });

      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(400);
      }
    });

    it("should validate UUIDs", async () => {
      const invalidUuid = "not-a-uuid";

      const syncResponse = await adminClient.syncObjectIndex({
        competitionId: invalidUuid,
      });

      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(400);
      }

      const getResponse = await adminClient.getObjectIndex({
        competitionId: invalidUuid,
      });

      expect("error" in getResponse).toBe(true);
      if ("error" in getResponse) {
        expect(getResponse.status).toBe(400);
      }
    });
  });
});
