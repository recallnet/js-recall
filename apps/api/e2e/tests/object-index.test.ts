import { afterEach, beforeEach, describe, expect, it } from "vitest";
import axios from "axios";
import { ApiClient } from "../utils/api-client.js";
import { getBaseUrl } from "../utils/server.js";
import { 
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  registerUserAndAgentAndGetClient,
  startTestCompetition
} from "../utils/test-helpers.js";
import { BlockchainType } from "../utils/api-types.js";
import { ServiceRegistry } from "@/services/index.js";

describe("Object Index Tests", () => {
  const services = new ServiceRegistry();
  let adminClient: ApiClient;
  let agentClient: ApiClient;
  let adminApiKey: string;
  let userId: string;
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
    adminApiKey = adminResponse.data.apiKey;
    adminClient = new ApiClient(adminApiKey);
    
    // Set up user and agent
    const setup = await registerUserAndAgentAndGetClient({ adminApiKey });
    agentClient = setup.client;
    userId = setup.user.id;
    agentId = setup.agent.id;
    
    // Create and start a test competition
    const competition = await startTestCompetition(
      adminClient,
      "Test Competition for Object Index",
      [agentId]
    );
    competitionId = competition.competition.id;
  });

  afterEach(async () => {
    await cleanupTestState();
  });

  describe("Object Index after endCompetition", () => {
    it("should populate object_index entries when competition ends", async () => {
      // Make some trades
      const tradeResponse1 = await agentClient.executeTrade({
        fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        amount: "100",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Test trade 1"
      });
      
      if ("error" in tradeResponse1) {
        throw new Error(`Trade failed: ${tradeResponse1.error}`);
      }
      
      const tradeResponse2 = await agentClient.executeTrade({
        fromToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        toToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        amount: "0.1",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Test trade 2"
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check object_index entries
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId,
        limit: 100
      });
      
      if ("error" in objectIndexResponse) {
        throw new Error(`Failed to get object index: ${objectIndexResponse.error}`);
      }
      
      // Verify we have entries
      expect(objectIndexResponse.success).toBe(true);
      expect(objectIndexResponse.data.entries.length).toBeGreaterThan(0);
      
      // Check for different data types
      const dataTypes = new Set(objectIndexResponse.data.entries.map(e => e.dataType));
      
      // Should have at least trades
      expect(dataTypes.has("trade")).toBe(true);
      
      // Verify trade entries
      const tradeEntries = objectIndexResponse.data.entries.filter(e => e.dataType === "trade");
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
      const tradeResponse = await agentClient.executeTrade({
        fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        amount: "50",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Test trade for sync"
      });
      
      if ("error" in tradeResponse) {
        throw new Error(`Trade failed: ${tradeResponse.error}`);
      }
      
      // Wait a bit for trade to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Manually trigger sync for specific data types
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["trade"]
      });
      
      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }
      
      expect(syncResponse.success).toBe(true);
      expect(syncResponse.dataTypes).toContain("trade");
      
      // Verify the data was synced
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade"
      });
      
      if ("error" in objectIndexResponse) {
        throw new Error(`Failed to get object index: ${objectIndexResponse.error}`);
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
      const tradeResponse = await agentClient.executeTrade({
        fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        amount: "25",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Test trade for full sync"
      });
      
      if ("error" in tradeResponse) {
        throw new Error(`Trade failed: ${tradeResponse.error}`);
      }
      
      // Wait a bit for trade to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Sync without specifying data types (should use defaults)
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId
      });
      
      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }
      
      expect(syncResponse.success).toBe(true);
      expect(syncResponse.dataTypes.length).toBeGreaterThan(0);
      
      // Check what was synced
      const objectIndexResponse = await adminClient.getObjectIndex({
        competitionId
      });
      
      if ("error" in objectIndexResponse) {
        throw new Error(`Failed to get object index: ${objectIndexResponse.error}`);
      }
      
      expect(objectIndexResponse.success).toBe(true);
      expect(objectIndexResponse.data.entries.length).toBeGreaterThan(0);
    });

    it("should handle pagination correctly", async () => {
      // Create multiple trades
      for (let i = 0; i < 5; i++) {
        const tradeResponse = await agentClient.executeTrade({
          fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
          toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
          amount: String(10 + i),
          fromChain: BlockchainType.EVM,
          toChain: BlockchainType.EVM,
          reason: `Test trade ${i}`
        });
        
        if ("error" in tradeResponse) {
          throw new Error(`Trade ${i} failed: ${tradeResponse.error}`);
        }
      }
      
      // Wait for trades to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sync the trades
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["trade"]
      });
      
      if ("error" in syncResponse) {
        throw new Error(`Sync failed: ${syncResponse.error}`);
      }
      
      // Test pagination
      const page1 = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade",
        limit: 2,
        offset: 0
      });
      
      if ("error" in page1) {
        throw new Error(`Failed to get page 1: ${page1.error}`);
      }
      
      const page2 = await adminClient.getObjectIndex({
        competitionId,
        dataType: "trade",
        limit: 2,
        offset: 2
      });
      
      if ("error" in page2) {
        throw new Error(`Failed to get page 2: ${page2.error}`);
      }
      
      expect(page1.data.entries.length).toBe(2);
      expect(page2.data.entries.length).toBe(2);
      expect(page1.data.pagination.total).toBeGreaterThanOrEqual(5);
      expect(page2.data.pagination.total).toBeGreaterThanOrEqual(5);
      
      // Ensure different entries
      const page1Ids = page1.data.entries.map(e => e.id);
      const page2Ids = page2.data.entries.map(e => e.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it("should filter by agent correctly", async () => {
      // Register another user and agent
      const setup2 = await registerUserAndAgentAndGetClient({ adminApiKey });
      const agent2Client = setup2.client;
      const agent2Id = setup2.agent.id;
      
      // Join competition with second agent
      const joinResponse = await agent2Client.joinCompetition(competitionId, agent2Id);
      if ("error" in joinResponse) {
        throw new Error(`Failed to join competition with agent 2: ${joinResponse.error}`);
      }
      
      // Make trades with both agents
      await agentClient.executeTrade({
        fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        amount: "100",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Agent 1 trade"
      });
      
      await agent2Client.executeTrade({
        fromToken: "0xf08A50178dfcDe18524640EA6618a1f965821715", // USDC
        toToken: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        amount: "200",
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        reason: "Agent 2 trade"
      });
      
      // Wait for trades to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sync trades
      await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["trade"]
      });
      
      // Filter by first agent
      const agent1Entries = await adminClient.getObjectIndex({
        competitionId,
        agentId,
        dataType: "trade"
      });
      
      if ("error" in agent1Entries) {
        throw new Error(`Failed to get agent 1 entries: ${agent1Entries.error}`);
      }
      
      // Filter by second agent
      const agent2Entries = await adminClient.getObjectIndex({
        competitionId,
        agentId: agent2Id,
        dataType: "trade"
      });
      
      if ("error" in agent2Entries) {
        throw new Error(`Failed to get agent 2 entries: ${agent2Entries.error}`);
      }
      
      // Verify filtering works
      expect(agent1Entries.data.entries.every(e => e.agentId === agentId)).toBe(true);
      expect(agent2Entries.data.entries.every(e => e.agentId === agent2Id)).toBe(true);
      expect(agent1Entries.data.entries.length).toBeGreaterThanOrEqual(1);
      expect(agent2Entries.data.entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error handling", () => {
    it("should require admin authentication", async () => {
      const nonAdminClient = new ApiClient("invalid-api-key");
      
      const syncResponse = await nonAdminClient.syncObjectIndex({
        competitionId
      });
      
      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(401);
      }
      
      const getResponse = await nonAdminClient.getObjectIndex({
        competitionId
      });
      
      expect("error" in getResponse).toBe(true);
      if ("error" in getResponse) {
        expect(getResponse.status).toBe(401);
      }
    });

    it("should validate data types", async () => {
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId,
        dataTypes: ["invalid_type"]
      });
      
      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(400);
      }
    });

    it("should validate UUIDs", async () => {
      const invalidUuid = "not-a-uuid";
      
      const syncResponse = await adminClient.syncObjectIndex({
        competitionId: invalidUuid
      });
      
      expect("error" in syncResponse).toBe(true);
      if ("error" in syncResponse) {
        expect(syncResponse.status).toBe(400);
      }
      
      const getResponse = await adminClient.getObjectIndex({
        competitionId: invalidUuid
      });
      
      expect("error" in getResponse).toBe(true);
      if ("error" in getResponse) {
        expect(getResponse.status).toBe(400);
      }
    });
  });
});