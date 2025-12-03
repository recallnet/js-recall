import { beforeEach, describe, expect, test, vi } from "vitest";

import { PriceTrackerService } from "@recallnet/services";
import { MultiChainProvider } from "@recallnet/services/providers";
import { BlockchainType } from "@recallnet/services/types";
import { BalancesResponse, SnapshotResponse } from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import config from "@/config/index.js";
import { logger } from "@/lib/logger.js";
import { ServiceRegistry } from "@/services/index.js";

const reason = "portfolio-snapshots end-to-end tests";

describe("Portfolio Snapshots", () => {
  const services = new ServiceRegistry();

  let adminApiKey: string;

  // Reset database between tests
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  // Test that a snapshot is taken when a competition starts
  test("takes a snapshot when a competition starts", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Snapshot Test Agent",
    });

    // Start a competition with our agent
    const competitionName = `Snapshot Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Wait for operations to complete
    await wait(500);

    // Get the competition ID
    const competitionId = startResult.competition.id;

    // Verify that a portfolio snapshot was taken for the agent
    const snapshotsResponse = await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    );
    const typedResponse = snapshotsResponse as SnapshotResponse;
    expect(typedResponse.success).toBe(true);
    expect(typedResponse.snapshots).toBeDefined();
    expect(typedResponse.snapshots.length).toBeGreaterThan(0);

    // Verify the snapshot has the correct agent ID and competition ID
    const snapshot = typedResponse.snapshots[0];
    expect(snapshot?.agentId).toBe(agent.id);
    expect(snapshot?.competitionId).toBe(competitionId);
    // Verify the snapshot has a total value
    expect(snapshot?.totalValue).toBeDefined();
    expect(snapshot?.totalValue).toBeGreaterThan(0);
  });

  // Test that snapshots can be taken manually
  test("manually taking snapshots creates new portfolio snapshots", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Periodic Snapshot Agent",
    });

    // Start a competition with our agent
    const competitionName = `Periodic Snapshot Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Get the competition ID
    const competitionId = startResult.competition.id;

    // Wait for initial snapshot to be taken
    await wait(500);

    // Initial snapshot count
    const initialSnapshotsResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const initialSnapshotCount = initialSnapshotsResponse.snapshots.length;

    // Force a snapshot directly
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );
    // Wait for snapshot to be processed
    await wait(500);

    // Get snapshots again
    const afterFirstSnapshotResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const afterFirstSnapshotCount = afterFirstSnapshotResponse.snapshots.length;

    // Should have at least one more snapshot (account for potential auto snapshots)
    expect(afterFirstSnapshotCount).toBeGreaterThan(initialSnapshotCount);
    // Store the current count for next comparison
    const countAfterFirstManualSnapshot = afterFirstSnapshotCount;

    // Force another snapshot
    await services.portfolioSnapshotterService.takePortfolioSnapshots(
      competitionId,
    );

    // Wait for snapshot to be processed
    await wait(500);

    // Get snapshots again
    const afterSecondSnapshotResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const afterSecondSnapshotCount =
      afterSecondSnapshotResponse.snapshots.length;

    // Should have at least one more snapshot than after the first manual snapshot
    expect(afterSecondSnapshotCount).toBeGreaterThan(
      countAfterFirstManualSnapshot,
    );
  });

  // Test that a snapshot is taken when a competition ends
  test("takes a snapshot when a competition ends", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "End Snapshot Agent",
    });

    // Start a competition with our agent
    const competitionName = `End Snapshot Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Get the competition ID
    const competitionId = startResult.competition.id;

    // Wait for initial snapshot to be taken
    await wait(500);

    // Execute a trade to change the portfolio composition
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    await client.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    // Wait for trade to process
    await wait(500);

    // Get snapshot count before ending
    const beforeEndResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const beforeEndCount = beforeEndResponse.snapshots.length;

    // End the competition
    await adminClient.endCompetition(competitionId);
    // Wait for operations to complete
    await wait(500);

    // Get snapshots after ending
    const afterEndResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const afterEndCount = afterEndResponse.snapshots.length;

    // Should have at least one more snapshot
    expect(afterEndCount).toBeGreaterThan(beforeEndCount);
    // Verify the final snapshot has a portfolio value
    const finalSnapshot =
      afterEndResponse.snapshots[afterEndResponse.snapshots.length - 1];
    expect(finalSnapshot?.totalValue).toBeDefined();
    expect(finalSnapshot?.totalValue).toBeGreaterThan(0);
  });

  // Test portfolio value calculation accuracy
  test("calculates portfolio value correctly based on token prices", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Value Calc Agent",
    });

    // Start a competition with our agent
    const competitionName = `Value Calculation Test ${Date.now()}`;
    const startResult = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Get the competition ID
    const competitionId = startResult.competition.id;

    // Wait for initial snapshot to be taken
    await wait(500);

    // Get initial balances
    const initialBalanceResponse = (await client.getBalance(
      competitionId,
    )) as BalancesResponse;

    // Verify we have a diversified portfolio with multiple tokens
    expect(initialBalanceResponse.balances.length).toBeGreaterThan(0);

    // Calculate expected portfolio value from the balance response
    // Each balance already includes the USD value calculation
    const expectedPortfolioValue = initialBalanceResponse.balances.reduce(
      (total, balance) => total + (balance.value || 0),
      0,
    );

    // Get initial snapshot
    const initialSnapshotsResponse = (await adminClient.request(
      "get",
      `/admin/competition/${competitionId}/snapshots`,
    )) as SnapshotResponse;
    const initialSnapshot = initialSnapshotsResponse.snapshots[0];
    expect(initialSnapshot).not.toBeUndefined();

    // Verify the portfolio value calculation matches the balance endpoint
    // Allow 1% tolerance for price fluctuations between balance and snapshot calls
    const tolerance = expectedPortfolioValue * 0.01;
    const actualDiff = Math.abs(
      initialSnapshot!.totalValue - expectedPortfolioValue,
    );
    expect(actualDiff).toBeLessThan(tolerance);
  });

  // Test that price freshness threshold works correctly
  test("reuses prices within freshness threshold", async () => {
    // Get the freshness threshold from config
    const freshnessThreshold = config.priceTracker.priceTTLMs;

    // Ensure we have a token priced in the database first by querying the price directly
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;

    // Use direct service call instead of API
    const multiChainProvider = new MultiChainProvider(config, logger);
    const priceTracker = new PriceTrackerService(
      multiChainProvider,
      config,
      logger,
    );
    await priceTracker.getPrice(usdcTokenAddress);

    const cacheSpy = vi.spyOn(priceTracker, "getCachedPrice");

    // Wait a bit, but less than the freshness threshold
    const waitTime = Math.min(freshnessThreshold / 3, 3000); // Wait 1/3 the threshold or max 3 seconds
    await wait(waitTime);

    // call again before cache expires
    await priceTracker.getPrice(usdcTokenAddress);

    expect(cacheSpy).toBeCalled();
    cacheSpy.mockReset();
  });
});
