import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  BalancesResponse,
  BlockchainType,
  CompetitionStatusResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  TeamProfileResponse,
  TeamRegistrationResponse,
  TradeResponse,
} from "@/e2e/utils/api-types.js";
import { getPool } from "@/e2e/utils/db-manager.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  generateRandomString,
  registerTeamAndGetClient,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";

/**
 * Generate a valid Ethereum address
 * @returns A valid Ethereum address (0x + 40 hex characters)
 */
function generateValidEthAddress(): string {
  const chars = "0123456789abcdef";
  let address = "0x";

  // Generate 40 random hex characters
  for (let i = 0; i < 40; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return address;
}

describe("Public Registration API", () => {
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
  });

  test("newly registered teams should be automatically added to an active competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team so we can use it when creating a competition
    // Register a team
    const { client: baseClient } = await registerTeamAndGetClient(adminClient);

    const teamProfile = (await baseClient.getProfile()) as TeamProfileResponse;

    // Start a competition with no teams initially
    const competitionName = `Auto-Join Test Competition ${Date.now()}`;
    const competitionResponse = await startTestCompetition(
      adminClient,
      competitionName,
      [teamProfile.team.id],
    );

    // Verify competition was started
    const competition = competitionResponse.competition;
    expect(competition).toBeDefined();
    expect(competition.name).toBe(competitionName);
    expect(competition.status).toBe("ACTIVE");
    expect(competition.teamIds?.length || 0).toBe(1); // Only the base team is registered

    // Create a public client
    const publicClient = createTestClient();

    // Register a new team directly through the public registration endpoint
    const teamName = `Auto-Join Team ${generateRandomString(8)}`;
    const email = `autojoin-${generateRandomString(8)}@example.com`;
    const contactPerson = "Auto Join Tester";
    const walletAddress = generateValidEthAddress();

    const publicRegistrationResponse = (await publicClient.publicRegisterTeam(
      teamName,
      email,
      contactPerson,
      walletAddress,
    )) as TeamRegistrationResponse;

    // Verify registration was successful
    expect(publicRegistrationResponse.success).toBe(true);
    expect(publicRegistrationResponse.team).toBeDefined();

    // Check that the response indicates the team was added to the competition
    expect(publicRegistrationResponse.joinedActiveCompetition).toBe(true);

    const teamId = publicRegistrationResponse.team.id;
    const teamApiKey = publicRegistrationResponse.team.apiKey;

    // Create a client for the newly registered team
    const teamClient = publicClient.createTeamClient(teamApiKey);

    // Check if the team can access the competition status endpoint (only works if team is active)
    const statusResponse =
      (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;

    // Verify team is participating in the competition
    expect(statusResponse.success).toBe(true);
    expect(statusResponse.active).toBe(true);
    expect(statusResponse.competition?.id).toBe(competition.id);
    expect(statusResponse.participating).toBe(true);

    // Check that the team can access the leaderboard
    const leaderboardResponse =
      (await teamClient.getLeaderboard()) as LeaderboardResponse;
    expect(leaderboardResponse.success).toBe(true);
    expect(leaderboardResponse.leaderboard).toBeDefined();
    expect(leaderboardResponse.leaderboard.length).toBe(2);

    // Find the team in the leaderboard
    const teamInLeaderboard = leaderboardResponse.leaderboard.find(
      (entry: LeaderboardEntry) => entry.teamId === teamId,
    );
    expect(teamInLeaderboard).toBeDefined();
    expect(teamInLeaderboard?.teamName).toBe(teamName);
    expect(teamInLeaderboard?.active).toBe(true);

    // ensure the team can place trades
    const initialBalanceResponse = await teamClient.getBalance();
    expect((initialBalanceResponse as BalancesResponse).success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    console.log(
      JSON.stringify(initialBalanceResponse),
      "initialBalanceResponse test",
    );
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available
    console.log(
      `Trade amount: ${tradeAmount} (should be less than ${initialUsdcBalance})`,
    );

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Test trade",
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();
  });

  test("public registration should work when no competition is active", async () => {
    // Create a public client
    const publicClient = createTestClient();

    // Register a new team when no competition is active
    const teamName = `No-Comp Team ${generateRandomString(8)}`;
    const email = `no-comp-${generateRandomString(8)}@example.com`;
    const contactPerson = "No Competition Tester";
    const walletAddress = generateValidEthAddress();

    const publicRegistrationResponse = (await publicClient.publicRegisterTeam(
      teamName,
      email,
      contactPerson,
      walletAddress,
    )) as TeamRegistrationResponse;

    // Verify registration was successful
    expect(publicRegistrationResponse.success).toBe(true);
    expect(publicRegistrationResponse.team).toBeDefined();

    // Check that the response indicates the team was not added to any competition
    expect(publicRegistrationResponse.joinedActiveCompetition).toBe(false);

    const teamId = publicRegistrationResponse.team.id;

    // Verify team is in the database, but not active
    const pool = getPool();
    const dbResult = await pool.query(
      "SELECT active FROM teams WHERE id = $1",
      [teamId],
    );
    expect(dbResult.rows.length).toBe(1);
    expect(dbResult.rows[0]?.active).toBe(false);
  });
});
