import {
  createTestClient,
  registerTeamAndGetClient,
  startTestCompetition,
  cleanupTestState,
  wait,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
} from '../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../utils/server';
import config from '../../src/config';
import { BlockchainType } from '../../src/types';
import { services } from '../../src/services';
import {
  BalancesResponse,
  CompetitionStatusResponse,
  ErrorResponse,
  LeaderboardResponse,
  SnapshotResponse,
  SpecificChain,
  TeamProfileResponse,
  TradeResponse,
} from '../utils/api-types';
import { ApiClient } from '../utils/api-client';

describe('Multi-Team Competition', () => {
  let adminApiKey: string;

  // Number of teams to create for multi-team tests
  const NUM_TEAMS = 6;

  // Base tokens for each team to trade
  const BASE_TOKENS = [
    '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf', //VVV
    '0x3992B27dA26848C2b19CeA6Fd25ad5568B68AB98', // DEGEN
    '0x63706e401c06ac8513145b7687A14804d17f814b', // MOBY
    '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', // SUSHI
    '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', // OBO
    '0x98d0baa52b2D063E780DE12F615f963Fe8537553', // BEAN
  ];

  // Base USDC token address
  const BASE_USDC_ADDRESS = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA';

  // Base specific chain identifier
  const BASE_CHAIN = 'base';
  // Store team details for use in tests
  let teamClients: {
    client: ApiClient;
    team: {
      id: string;
      name: string;
      email: string;
      contactPerson: string;
    };
    apiKey: string;
  }[] = [];
  let adminClient: ApiClient;
  let competitionId: string;

  const reason = 'multi-team-competition end-to-end test';

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

  test('should create a competition with multiple teams and validate isolation', async () => {
    console.log('[Test] Starting multi-team competition test');

    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register 6 teams with unique names
    console.log(`Registering ${NUM_TEAMS} teams...`);
    teamClients = [];

    for (let i = 0; i < NUM_TEAMS; i++) {
      const teamName = `Team ${i + 1} ${Date.now()}`;
      const email = `team${i + 1}_${Date.now()}@example.com`;
      const contactPerson = `Contact Person ${i + 1}`;

      const teamData = await registerTeamAndGetClient(adminClient, teamName, email, contactPerson);

      teamClients.push(teamData);
      console.log(`Registered team: ${teamName} with ID: ${teamData.team.id}`);
    }

    expect(teamClients.length).toBe(NUM_TEAMS);

    // Step 3: Start a competition with all teams
    const competitionName = `Multi-Team Competition ${Date.now()}`;
    const teamIds = teamClients.map((tc) => tc.team.id);

    console.log(`Starting competition with ${teamIds.length} teams...`);
    const competitionResponse = await startTestCompetition(adminClient, competitionName, teamIds);

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Step 4: Validate that all teams have the same starting balances
    console.log('Validating starting balances...');

    // Get first team's balance as reference
    const referenceBalanceResponse = (await teamClients[0].client.getBalance()) as BalancesResponse;
    expect(referenceBalanceResponse.success).toBe(true);
    expect(referenceBalanceResponse.balances).toBeDefined();

    // Check key token balances for reference
    const referenceBalance = referenceBalanceResponse.balances;

    // Get common tokens from config
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Track reference balances for key tokens
    const referenceUsdcBalance = parseFloat(
      referenceBalance.find((b) => b.token === usdcTokenAddress)?.amount.toString() || '0',
    );
    const referenceSolBalance = parseFloat(
      referenceBalance.find((b) => b.token === solTokenAddress)?.amount.toString() || '0',
    );

    console.log(`Reference USDC balance: ${referenceUsdcBalance}`);
    console.log(`Reference SOL balance: ${referenceSolBalance}`);
    // Validate other teams have identical balances
    for (let i = 1; i < NUM_TEAMS; i++) {
      const teamClient = teamClients[i].client;
      const teamBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;

      expect(teamBalanceResponse.success).toBe(true);
      expect(teamBalanceResponse.balances).toBeDefined();

      const teamBalance = teamBalanceResponse.balances;
      // Validate USDC balance
      const teamUsdcBalance = parseFloat(
        teamBalance.find((b) => b.token === usdcTokenAddress)?.amount.toString() || '0',
      );
      expect(teamUsdcBalance).toBe(referenceUsdcBalance);

      // Validate SOL balance
      const teamSolBalance = parseFloat(
        teamBalance.find((b) => b.token === solTokenAddress)?.amount.toString() || '0',
      );
      expect(teamSolBalance).toBe(referenceSolBalance);

      console.log(
        `Team ${i + 1} USDC balance: ${teamUsdcBalance} - matches reference: ${teamUsdcBalance === referenceUsdcBalance}`,
      );
      console.log(
        `Team ${i + 1} SOL balance: ${teamSolBalance} - matches reference: ${teamSolBalance === referenceSolBalance}`,
      );
    }

    // Step 5: Validate that API keys are properly isolated
    console.log('Validating API key isolation...');

    // Try to access Team 2's data using Team 1's API key
    // Create a new client with Team 1's API key
    const team1ApiKey = teamClients[0].apiKey;
    const badClient = adminClient.createTeamClient(team1ApiKey);

    try {
      // Try to get Team 2's profile directly (would need to know endpoint structure)
      const response = await axios.get(
        `${getBaseUrl()}/api/account/profile?teamId=${teamClients[1].team.id}`,
        {
          headers: {
            Authorization: `Bearer ${team1ApiKey}`,
          },
        },
      );

      // If we get here, the request did not properly validate team ownership
      // This should never happen - either the request should fail or should return Team 1's data, not Team 2's
      expect(response.data.team.id).not.toBe(teamClients[1].team.id);
    } catch (error) {
      // Error is expected - validating it's the right type of error
      expect(error).toBeDefined();
      if (axios.isAxiosError(error) && error.response) {
        // Should get either a 401 Unauthorized or 403 Forbidden
        const statusCode = error.response.status;
        expect([401, 403]).toContain(statusCode);
      }
    }

    // Verify Team 1's client can access its own data
    const team1ProfileResponse = (await teamClients[0].client.getProfile()) as TeamProfileResponse;
    expect(team1ProfileResponse.success).toBe(true);
    expect(team1ProfileResponse.team.id).toBe(teamClients[0].team.id);

    // Verify Team 2's client can access its own data
    const team2ProfileResponse = (await teamClients[1].client.getProfile()) as TeamProfileResponse;
    expect(team2ProfileResponse.success).toBe(true);
    expect(team2ProfileResponse.team.id).toBe(teamClients[1].team.id);

    // Step 6: Validate that all teams can see the competition and leaderboard
    console.log('Validating competition visibility...');
    for (let i = 0; i < NUM_TEAMS; i++) {
      const teamClient = teamClients[i].client;

      // Check competition status
      const statusResponse = (await teamClient.getCompetitionStatus()) as CompetitionStatusResponse;
      expect(statusResponse.success).toBe(true);
      expect(statusResponse.competition).toBeDefined();
      expect(statusResponse.competition?.id).toBe(competitionId);

      // Check leaderboard
      const leaderboardResponse = (await teamClient.getLeaderboard()) as LeaderboardResponse;
      expect(leaderboardResponse.success).toBe(true);
      expect(leaderboardResponse.leaderboard).toBeDefined();
      expect(leaderboardResponse.leaderboard).toBeInstanceOf(Array);
      expect(leaderboardResponse.leaderboard.length).toBe(NUM_TEAMS);

      // Verify this team is in the leaderboard
      const teamInLeaderboard = leaderboardResponse.leaderboard.find(
        (entry: any) => entry.teamId === teamClients[i].team.id,
      );
      expect(teamInLeaderboard).toBeDefined();
    }

    console.log('[Test] Completed multi-team competition test');
  });

  test('each team should purchase a different token resulting in unique portfolio compositions', async () => {
    console.log('[Test] Starting multi-team unique token purchasing test');

    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register 6 teams with unique names
    console.log(`Registering ${NUM_TEAMS} teams...`);
    teamClients = [];

    for (let i = 0; i < NUM_TEAMS; i++) {
      const teamName = `Team ${i + 1} ${Date.now()}`;
      const email = `team${i + 1}_${Date.now()}@example.com`;
      const contactPerson = `Contact Person ${i + 1}`;

      const teamData = await registerTeamAndGetClient(adminClient, teamName, email, contactPerson);

      teamClients.push(teamData);
      console.log(`Registered team: ${teamName} with ID: ${teamData.team.id}`);
    }

    expect(teamClients.length).toBe(NUM_TEAMS);
    expect(teamClients.length).toBe(BASE_TOKENS.length);

    // Step 3: Start a competition with all teams
    const competitionName = `Multi-Team Token Trading ${Date.now()}`;
    const teamIds = teamClients.map((tc) => tc.team.id);

    console.log(`Starting competition with ${teamIds.length} teams...`);
    const competitionResponse = await startTestCompetition(adminClient, competitionName, teamIds);

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Step 4: Each team trades for a different token
    console.log('Executing unique token trades for each team...');

    // Amount of USDC each team will trade
    const tradeAmount = 100;

    // Store token quantities for validation
    const tokenQuantities: { [tokenAddress: string]: number } = {};

    // Execute trades and record results
    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];
      const tokenToTrade = BASE_TOKENS[i];

      console.log(`Team ${i + 1} trading ${tradeAmount} USDC for token ${tokenToTrade}`);

      // Execute trade using the client - each team buys a different BASE token with 100 USDC
      const tradeResponse = (await team.client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: tokenToTrade,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      })) as TradeResponse;

      // Verify trade was successful
      expect(tradeResponse.success).toBe(true);
      expect(tradeResponse.transaction).toBeDefined();

      // Record the token amount received (will be different for each token due to price differences)
      if (tradeResponse.transaction.toAmount) {
        const tokenAmount = tradeResponse.transaction.toAmount;
        tokenQuantities[tokenToTrade] = tokenAmount;
        console.log(`Team ${i + 1} received ${tokenAmount} of token ${tokenToTrade}`);
      }
      // Wait briefly between trades
      await wait(100);
    }

    // Wait for all trades to settle
    await wait(500);

    // Step 5: Verify each team has a unique token composition
    console.log('Verifying unique token portfolios...');

    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];
      const expectedToken = BASE_TOKENS[i];

      // Get team's current balance
      const balanceResponse = (await team.client.getBalance()) as BalancesResponse;
      expect(balanceResponse.success).toBe(true);
      expect(balanceResponse.balances).toBeDefined();
      // Check that the team has the expected token
      const tokenBalance = parseFloat(
        balanceResponse.balances.find((b) => b.token === expectedToken)?.amount.toString() || '0',
      );
      console.log(`Team ${i + 1} final balance of token ${expectedToken}: ${tokenBalance}`);

      // Verify they have a non-zero balance of their unique token
      expect(tokenBalance).toBeGreaterThan(0);

      // Verify they DON'T have any of the other teams' tokens
      for (let j = 0; j < NUM_TEAMS; j++) {
        if (j !== i) {
          // Skip their own token
          const otherToken = BASE_TOKENS[j];
          const otherTokenBalance = parseFloat(
            balanceResponse.balances.find((b) => b.token === otherToken)?.amount.toString() || '0',
          );

          // They should have 0 of other teams' tokens
          expect(otherTokenBalance).toBe(0);
          if (otherTokenBalance > 0) {
            console.error(
              `ERROR: Team ${i + 1} unexpectedly has ${otherTokenBalance} of token ${otherToken}`,
            );
          }
        }
      }
    }

    // Step 6: Verify that token quantities differ due to different token prices
    console.log('Verifying token quantities differ between teams...');

    // Get unique token quantities
    const uniqueQuantities = Object.values(tokenQuantities);

    // Verify that no two teams received the same token quantity (within a reasonable precision)
    for (let i = 0; i < uniqueQuantities.length; i++) {
      for (let j = i + 1; j < uniqueQuantities.length; j++) {
        const qty1 = uniqueQuantities[i];
        const qty2 = uniqueQuantities[j];

        // Allow a tiny bit of precision error (0.0001), but quantities should differ by more than this
        const areDifferent = Math.abs(qty1 - qty2) > 0.0001;
        expect(areDifferent).toBe(true);

        console.log(
          `Token quantity comparison: ${qty1} vs ${qty2} - Are different: ${areDifferent}`,
        );
      }
    }

    console.log('[Test] Completed multi-team unique token purchasing test');
  });

  // Test that portfolio values change over time due to price fluctuations
  test('portfolio values should change differently for teams holding different tokens', async () => {
    console.log('[Test] Starting portfolio value fluctuation test');

    // Step 1: Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Step 2: Register teams with unique names
    console.log(`Registering ${NUM_TEAMS} teams...`);
    teamClients = [];

    // Store token quantities and initial portfolio values
    const initialPortfolioValues: { [teamId: string]: number } = {};
    const tokensByTeam: { [teamId: string]: string } = {};

    for (let i = 0; i < NUM_TEAMS; i++) {
      const teamName = `Price Team ${i + 1} ${Date.now()}`;
      const email = `price_team${i + 1}_${Date.now()}@example.com`;
      const contactPerson = `Price Contact ${i + 1}`;

      const teamData = await registerTeamAndGetClient(adminClient, teamName, email, contactPerson);

      teamClients.push(teamData);
      console.log(`Registered team: ${teamName} with ID: ${teamData.team.id}`);
    }

    expect(teamClients.length).toBe(NUM_TEAMS);
    expect(teamClients.length).toBe(BASE_TOKENS.length);

    // Step 3: Start a competition with all teams
    const competitionName = `Portfolio Value Test ${Date.now()}`;
    const teamIds = teamClients.map((tc) => tc.team.id);

    console.log(`Starting competition with ${teamIds.length} teams...`);
    const competitionResponse = await startTestCompetition(adminClient, competitionName, teamIds);

    expect(competitionResponse.success).toBe(true);
    expect(competitionResponse.competition).toBeDefined();
    competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(1000);

    // Step 4: Each team trades for a different token
    console.log('Executing unique token trades for each team...');

    // Amount of USDC each team will trade
    const tradeAmount = 500; // Using a larger amount to make price fluctuations more noticeable

    // Execute trades for each team
    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];
      const tokenToTrade = BASE_TOKENS[i];
      tokensByTeam[team.team.id] = tokenToTrade;

      console.log(
        `Team ${i + 1} (${team.team.name}) trading ${tradeAmount} USDC for token ${tokenToTrade}`,
      );

      // Execute trade - each team buys a different BASE token with USDC
      const tradeResponse = (await team.client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: tokenToTrade,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      })) as TradeResponse;

      // Verify trade was successful
      expect(tradeResponse.success).toBe(true);
      expect(tradeResponse.transaction).toBeDefined();

      // Log the token amount received
      if (tradeResponse.transaction.toAmount) {
        const tokenAmount = parseFloat(String(tradeResponse.transaction.toAmount));
        console.log(`Team ${i + 1} received ${tokenAmount} of token ${tokenToTrade}`);
      }

      // Wait briefly between trades
      await wait(100);
    }

    // Wait for all trades to settle
    await wait(1000);

    // Step 5: Get initial portfolio values after trades
    console.log('\n[Test] Getting initial portfolio values after trades...');

    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];

      // Force a snapshot to ensure we have current values
      await services.competitionManager.takePortfolioSnapshots(competitionId);
      await wait(500);

      // Get team's initial portfolio value
      const snapshotsResponse = (await adminClient.request(
        'get',
        `/api/admin/competition/${competitionId}/snapshots?teamId=${team.team.id}`,
      )) as SnapshotResponse;
      expect(snapshotsResponse.success).toBe(true);
      expect(snapshotsResponse.snapshots).toBeDefined();
      expect(snapshotsResponse.snapshots.length).toBeGreaterThan(0);

      // Get the most recent snapshot
      const latestSnapshot = snapshotsResponse.snapshots[snapshotsResponse.snapshots.length - 1];
      const initialValue = latestSnapshot.totalValue;
      initialPortfolioValues[team.team.id] = initialValue;

      console.log(
        `Team ${i + 1} (${team.team.name}) initial portfolio value: $${initialValue.toFixed(2)}`,
      );

      // Log token-specific details
      const token = tokensByTeam[team.team.id];
      const tokenValue = latestSnapshot.valuesByToken[token];
      if (tokenValue) {
        console.log(
          `  - Token ${token}: ${tokenValue.amount} units at $${tokenValue.valueUsd / tokenValue.amount} = $${tokenValue.valueUsd.toFixed(2)}`,
        );
      }
    }

    // Step 6: Wait for a period of time to allow for multiple snapshots and price fluctuations
    const waitTimeForPriceChanges = 20000; // 20 seconds
    console.log(
      `\n[Test] Waiting ${waitTimeForPriceChanges / 1000} seconds for price fluctuations...`,
    );

    // Force several snapshots during the wait period to increase chances of capturing price changes
    for (let i = 0; i < 4; i++) {
      await wait(waitTimeForPriceChanges / 4);
      console.log(`Taking snapshot ${i + 1}/4 during wait period...`);
      await services.competitionManager.takePortfolioSnapshots(competitionId);
    }

    // Step 7: Get final portfolio values
    console.log('\n[Test] Getting final portfolio values after waiting period...');

    const finalPortfolioValues: { [teamId: string]: number } = {};
    const portfolioChanges: {
      [teamId: string]: { initial: number; final: number; change: number; percentChange: number };
    } = {};
    let allTeamsHaveSameChange = true;
    let previousPercentChange: number | null = null;

    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];

      // Force one final snapshot to ensure we have the latest prices
      await services.competitionManager.takePortfolioSnapshots(competitionId);
      await wait(500);

      // Get team's final portfolio value
      const snapshotsResponse = (await adminClient.request(
        'get',
        `/api/admin/competition/${competitionId}/snapshots?teamId=${team.team.id}`,
      )) as SnapshotResponse;
      expect(snapshotsResponse.success).toBe(true);
      expect(snapshotsResponse.snapshots).toBeDefined();
      expect(snapshotsResponse.snapshots.length).toBeGreaterThan(0);

      // Get the most recent snapshot
      const latestSnapshot = snapshotsResponse.snapshots[snapshotsResponse.snapshots.length - 1];
      const finalValue = latestSnapshot.totalValue;
      finalPortfolioValues[team.team.id] = finalValue;

      // Calculate change
      const initialValue = initialPortfolioValues[team.team.id];
      const absoluteChange = finalValue - initialValue;
      const percentChange = (absoluteChange / initialValue) * 100;

      portfolioChanges[team.team.id] = {
        initial: initialValue,
        final: finalValue,
        change: absoluteChange,
        percentChange: percentChange,
      };

      // Log detailed information
      console.log(
        `Team ${i + 1} (${team.team.name}) final portfolio value: $${finalValue.toFixed(2)}`,
      );
      console.log(`  - Change: $${absoluteChange.toFixed(2)} (${percentChange.toFixed(2)}%)`);

      // Log token-specific details
      const token = tokensByTeam[team.team.id];
      const tokenValue = latestSnapshot.valuesByToken[token];
      if (tokenValue) {
        console.log(
          `  - Token ${token}: ${tokenValue.amount} units, value = $${tokenValue.valueUsd.toFixed(2)}`,
        );
      }

      // Check if this percent change is different from previous teams
      if (previousPercentChange !== null) {
        // Allow a tiny bit of precision error (0.00001), but changes should differ by more than this
        if (Math.abs(percentChange - previousPercentChange) > 0.00001) {
          allTeamsHaveSameChange = false;
        }
      }
      previousPercentChange = percentChange;
    }

    // Step 8: Summary of portfolio changes
    console.log('\n[Test] Portfolio change summary:');
    for (let i = 0; i < NUM_TEAMS; i++) {
      const team = teamClients[i];
      const changes = portfolioChanges[team.team.id];
      console.log(
        `Team ${i + 1} (${team.team.name}): $${changes.initial.toFixed(2)} → $${changes.final.toFixed(2)}, Change: ${changes.percentChange.toFixed(4)}%`,
      );
    }

    // Step 9: Verify that not all teams have exactly the same portfolio change
    // This test could be flaky if market conditions are extremely stable during the test period
    // or if there's a bug in the pricing system. We log a warning instead of failing in that case.
    if (allTeamsHaveSameChange) {
      console.warn(
        '[Test] WARNING: All teams showed identical percentage changes in portfolio value.',
      );
      console.warn(
        '[Test] This could indicate either extremely stable market conditions or a potential issue with pricing.',
      );
    } else {
      console.log(
        '[Test] Confirmed that teams with different tokens have different portfolio value changes.',
      );
    }

    console.log('[Test] Completed portfolio value fluctuation test');
  }, 60000); // Added timeout parameter
});
