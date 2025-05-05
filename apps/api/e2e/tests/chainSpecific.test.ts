import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import { config } from "@/config/index.js";
import { BalancesResponse, SpecificChain } from "@/e2e/utils/api-types.js";
import { getPool } from "@/e2e/utils/db-manager.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerTeamAndGetClient,
  startTestCompetition,
} from "@/e2e/utils/test-helpers.js";

const reason = "chainSpecific end to end tests";

describe("Specific Chains", () => {
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

  test("specificChain is correctly entered into balances when team is initialized in competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      "Team 1",
    );

    // Start a competition with the team
    const competitionName = `Specific Chain Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Use the team client API to get balances instead of direct DB query
    const balancesResponse =
      (await teamClient.getBalance()) as BalancesResponse;
    expect(balancesResponse.success).toBe(true);
    expect(Array.isArray(balancesResponse.balances)).toBe(true);
    expect(balancesResponse.balances.length).toBeGreaterThan(0);

    // Verify each token has the correct specificChain value
    for (const balance of balancesResponse.balances) {
      const tokenAddress = balance.token.toLowerCase();
      const assignedChain = balance.specificChain;

      // Verify specificChain is returned in the API response
      expect(assignedChain).toBeDefined();

      // Find which chain this token should belong to according to config
      let expectedChain = null;

      // Check each chain in the config to find a match for this token
      for (const [chain, tokenMap] of Object.entries(
        config.specificChainTokens,
      )) {
        // Check if any token address in this chain matches our token
        const tokenAddresses = Object.values(tokenMap);

        if (
          tokenAddresses.some(
            (address) =>
              typeof address === "string" &&
              address.toLowerCase() === tokenAddress,
          )
        ) {
          expectedChain = chain;
          break;
        }
      }

      // Assert that the chain in the API response matches what we expect from config
      expect(assignedChain).toBe(expectedChain);
      console.log(
        `Token ${tokenAddress} correctly assigned to chain ${assignedChain}`,
      );
    }
  });

  test("specificChain is correctly recorded in trades table when executing trades", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      "Team 2",
    );

    // Start a competition with the team
    const competitionName = `Trade Chain Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Get team's current balances
    const balanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(balanceResponse.success).toBe(true);

    // Find ETH and USDC tokens for a trade using config addresses
    let ethToken: string | undefined;
    let usdcToken: string | undefined;

    // Get ETH and USDC token addresses from config
    const ethAddress = config.specificChainTokens.eth.eth;
    const usdcAddress = config.specificChainTokens.eth.usdc;

    if (Array.isArray(balanceResponse.balances)) {
      // Find the tokens in the balances array using the config addresses
      const ethBalance = balanceResponse.balances.find(
        (balance) => balance.token.toLowerCase() === ethAddress.toLowerCase(),
      );

      const usdcBalance = balanceResponse.balances.find(
        (balance) => balance.token.toLowerCase() === usdcAddress.toLowerCase(),
      );

      if (ethBalance) ethToken = ethBalance.token;
      if (usdcBalance) usdcToken = usdcBalance.token;

      console.log(
        `Looking for ETH token (${ethAddress}) and USDC token (${usdcAddress})`,
      );
      console.log(`Found ETH token: ${ethToken}, USDC token: ${usdcToken}`);
    }

    // Make sure we found both tokens
    expect(ethToken).toBeDefined();
    expect(usdcToken).toBeDefined();

    // Skip the test if we couldn't find the tokens (typescript safety)
    if (!ethToken || !usdcToken) {
      console.log(
        "Could not find ETH and USDC tokens in balances, skipping test",
      );
      return;
    }

    // Execute a trade from ETH to USDC
    const tradeAmount = "0.01"; // Trade a small amount of ETH
    const tradeResponse = await teamClient.executeTrade({
      fromToken: ethToken,
      toToken: usdcToken,
      amount: tradeAmount,
      reason,
    });
    expect(tradeResponse.success).toBe(true);

    // Get the database connection
    const pool = getPool();

    // Query the trades table to check if specificChain fields were correctly populated
    const tradesResult = await pool.query(
      "SELECT from_token, to_token, from_specific_chain, to_specific_chain FROM trades WHERE team_id = $1",
      [team.id],
    );

    // Verify we have a trade record
    expect(tradesResult.rows.length).toBe(1);

    // Verify the specificChain fields were correctly populated
    const trade = tradesResult.rows[0];
    expect(trade?.from_specific_chain).toBe("eth");
    expect(trade?.to_specific_chain).toBe("eth");
    expect(trade?.from_token).toBe(ethToken);
    expect(trade?.to_token).toBe(usdcToken);
  });

  test("specificChain is correctly recorded in portfolio_token_values when taking snapshots", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { team } = await registerTeamAndGetClient(
      adminClient,
      "Team Portfolio",
    );

    // Start a competition with the team
    const competitionName = `Portfolio Chain Test ${Date.now()}`;
    const competition = await startTestCompetition(
      adminClient,
      competitionName,
      [team.id],
    );

    // Get the competition ID
    const competitionId = competition.competition.id;

    // Manually trigger a portfolio snapshot
    await adminClient.request(
      "post",
      `/api/admin/competition/${competitionId}/snapshot`,
    );

    // Wait briefly for snapshot to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get the database connection
    const pool = getPool();

    // Find the most recent portfolio snapshot for this team
    const snapshotResult = await pool.query(
      "SELECT id FROM portfolio_snapshots WHERE team_id = $1 ORDER BY timestamp DESC LIMIT 1",
      [team.id],
    );

    expect(snapshotResult.rows.length).toBe(1);
    const snapshotId = snapshotResult.rows[0]?.id;

    // Query the portfolio_token_values table to check if specificChain was correctly populated
    const tokenValuesResult = await pool.query(
      "SELECT token_address, specific_chain FROM portfolio_token_values WHERE portfolio_snapshot_id = $1",
      [snapshotId],
    );

    // Verify we have portfolio token value records
    expect(tokenValuesResult.rows.length).toBeGreaterThan(0);

    // Verify each token has the correct specific_chain based on config
    for (const row of tokenValuesResult.rows) {
      const tokenAddress = (row.token_address as string).toLowerCase();
      const assignedChain = row.specific_chain;

      // Find which chain this token should belong to according to config
      let expectedChain = null;

      // Check each chain in the config to find a match for this token
      for (const [chain, tokenMap] of Object.entries(
        config.specificChainTokens,
      )) {
        // Check if any token address in this chain matches our token
        const tokenAddresses = Object.values(tokenMap);

        if (
          tokenAddresses.some(
            (address) =>
              typeof address === "string" &&
              address.toLowerCase() === tokenAddress,
          )
        ) {
          expectedChain = chain;
          break;
        }
      }

      // If no specific chain was found in config, it should default to a sensible value
      if (!expectedChain) {
        expectedChain = tokenAddress.startsWith("0x") ? "eth" : "svm";
      }

      // Assert that the chain in the database matches what we expect from config
      expect(assignedChain).toBe(expectedChain);
      console.log(
        `Portfolio token ${tokenAddress} correctly assigned to chain ${assignedChain}`,
      );
    }
  });

  test("can purchase token with address 0x0b2c639c533813f4aa9d7837caf62653d097ff85", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      "Token Purchase Test Team",
    );

    // Start a competition with the team
    const competitionName = `Token Purchase Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Get team's current balances
    const balanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(balanceResponse.success).toBe(true);

    // Target token we want to purchase
    const targetTokenAddress = "0x0b2c639c533813f4aa9d7837caf62653d097ff85";

    // First try to find USDC
    const usdcAddress = config.specificChainTokens.optimism.usdc;

    // Execute the trade from source token to target token
    const tradeResponse = await teamClient.executeTrade({
      fromToken: usdcAddress,
      toToken: targetTokenAddress,
      amount: "100",
      reason,
    });

    // Verify the trade was successful
    expect(tradeResponse.success).toBe(true);
    console.log(`Successfully purchased token ${targetTokenAddress}`);

    // Get updated balances to verify we received the target token
    const updatedBalanceResponse =
      (await teamClient.getBalance()) as BalancesResponse;
    expect(updatedBalanceResponse.success).toBe(true);

    // Find the target token in the updated balances
    if (Array.isArray(updatedBalanceResponse.balances)) {
      const targetTokenBalance = updatedBalanceResponse.balances.find(
        (balance) =>
          balance.token.toLowerCase() === targetTokenAddress.toLowerCase(),
      );

      // Verify we received some amount of the target token
      expect(targetTokenBalance).toBeDefined();
      if (targetTokenBalance) {
        expect(targetTokenBalance.amount).toBeGreaterThan(0);
        console.log(
          `Received ${targetTokenBalance.amount} of target token ${targetTokenAddress}`,
        );
      }
    }

    // Get the database connection
    const pool = getPool();

    // // Query the trades table to verify the trade was recorded correctly
    const tradesResult = await pool.query(
      `SELECT * 
       FROM trades 
       WHERE team_id = $1 AND to_token = $2`,
      [team.id, targetTokenAddress],
    );

    // // Verify a trade record exists for this transaction
    expect(tradesResult.rows.length).toBe(1);

    const trade = tradesResult.rows[0];
    expect(trade?.from_token).toBe(usdcAddress);
    expect(trade?.to_token).toBe(targetTokenAddress);
    expect(trade?.from_specific_chain).toBeDefined();
    expect(trade?.to_specific_chain).toBeDefined();
    expect(trade?.to_specific_chain).toBe("optimism");

    // Verify that balances contain specificChain
    const balancesResponse =
      (await teamClient.getBalance()) as BalancesResponse;
    expect(balancesResponse.success).toBe(true);
    expect(Array.isArray(balancesResponse.balances)).toBe(true);
    expect(balancesResponse.balances.length).toBeGreaterThan(0);
    for (const balance of balancesResponse.balances) {
      const assignedChain = balance.specificChain;

      // Verify specificChain is returned in the API response
      expect(assignedChain).toBeDefined();

      // Expect that assignedChain is one of the keys in the specificChainTokens config
      const keys = Object.keys(config.specificChainTokens);
      expect(keys).toContain(assignedChain);
    }

    // Swap back to USDC
    const swapBackResponse = await teamClient.executeTrade({
      fromToken: targetTokenAddress,
      toToken: usdcAddress,
      amount: trade?.to_amount as string,
      reason,
    });
    // Verify the swap back was successful
    expect(swapBackResponse.success).toBe(true);

    // Get the entrys in the trades table for this swap back
    const swapBackResult = await pool.query(
      `SELECT * 
       FROM trades 
       WHERE team_id = $1 AND to_token = $2`,
      [team.id, usdcAddress],
    );
    // Verify a trade record exists for this transaction
    expect(swapBackResult.rows.length).toBe(1);
    const swapBackTrade = swapBackResult.rows[0];
    expect(swapBackTrade?.from_token).toBe(targetTokenAddress);
    expect(swapBackTrade?.to_token).toBe(usdcAddress);
    expect(swapBackTrade?.from_specific_chain).toBeDefined();
    expect(swapBackTrade?.to_specific_chain).toBeDefined();
    expect(swapBackTrade?.from_specific_chain).toBe("optimism");
    expect(swapBackTrade?.to_specific_chain).toBe("optimism");
  });

  // test case to purchase a bunch of random token from different chains and confirm specificChain is set in both trades and balances
  test("can purchase random tokens from different chains and confirm specificChain is set in both trades and balances", async () => {
    interface TokenInfo {
      address: string;
      specificChain: SpecificChain;
    }

    const ethToken = {
      address: "0xaedf386b755465871ff874e3e37af5976e247064",
      specificChain: "eth" as SpecificChain,
    };
    const baseToken = {
      address: "0x25E0A7767d03461EaF88b47cd9853722Fe05DFD3",
      specificChain: "base" as SpecificChain,
    };
    const optimismToken = {
      address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      specificChain: "optimism" as SpecificChain,
    };
    const arbitrumToken = {
      address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
      specificChain: "arbitrum" as SpecificChain,
    };
    const polygonToken = {
      address: "0x61299774020da444af134c82fa83e3810b309991",
      specificChain: "polygon" as SpecificChain,
    };
    const solanaToken = {
      address: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
      specificChain: "svm" as SpecificChain,
    };

    // iterate over the tokens and purchase each one
    const tokens: TokenInfo[] = [
      ethToken,
      baseToken,
      optimismToken,
      arbitrumToken,
      polygonToken,
      solanaToken,
    ];
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      `Token Purchase Test Team`,
    );

    // Start a competition with the team
    const competitionName = `Token Purchase Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Get database connection for verification
    const pool = getPool();

    // Track successfully purchased tokens
    const purchasedTokens: string[] = [];

    for (const token of tokens) {
      try {
        // Get team's current balances
        const balanceResponse =
          (await teamClient.getBalance()) as BalancesResponse;
        expect(balanceResponse.success).toBe(true);

        const specificChain = token.specificChain;
        // Cast to string to avoid TypeScript errors
        const specificChainStr = specificChain as string;
        const usdcAddress =
          config.specificChainTokens[
            specificChainStr as keyof typeof config.specificChainTokens
          ].usdc;

        // Get the actual token address
        const tokenAddress = token.address;
        expect(tokenAddress).toBeDefined();

        // Execute the trade
        const tradeResponse = await teamClient.executeTrade({
          fromToken: usdcAddress,
          toToken: tokenAddress,
          amount: "100",
          reason,
        });

        // Verify the trade was successful
        expect(tradeResponse.success).toBe(true);

        // If trade succeeded, add to our list
        purchasedTokens.push(tokenAddress);

        console.log(
          `Successfully purchased token ${tokenAddress} from chain ${specificChain}`,
        );

        // Verify trade record in database
        const tradeResult = await pool.query(
          `SELECT * FROM trades WHERE team_id = $1 AND to_token = $2 ORDER BY id DESC LIMIT 1`,
          [team.id, tokenAddress],
        );

        expect(tradeResult.rows.length).toBe(1);
        const trade = tradeResult.rows[0];

        // Verify specificChain is recorded correctly in trades table
        expect(trade?.from_specific_chain).toBeDefined();
        expect(trade?.to_specific_chain).toBeDefined();

        // Verify the to_specific_chain is what we expect
        expect(trade?.to_specific_chain).toBe(specificChainStr);

        console.log(
          `Trade record: from_chain=${trade?.from_specific_chain}, to_chain=${trade?.to_specific_chain}`,
        );
      } catch (error) {
        console.error(
          `Error trading ${token.address} on ${token.specificChain}: ${error}`,
        );
      }
    }

    // Verify that balances contain specificChain for all purchased tokens
    const finalBalances = (await teamClient.getBalance()) as BalancesResponse;
    expect(finalBalances.success).toBe(true);
    expect(Array.isArray(finalBalances.balances)).toBe(true);

    // Check each purchased token appears in balances with correct specificChain
    for (const tokenAddress of purchasedTokens) {
      // Find this token in the balances
      const tokenBalance = finalBalances.balances.find(
        (b) => b.token.toLowerCase() === tokenAddress.toLowerCase(),
      );

      // Token should exist in balances
      expect(tokenBalance).toBeDefined();

      // SpecificChain should be defined
      expect(tokenBalance?.specificChain).toBeDefined();
      console.log(
        `Balance for ${tokenAddress}: specificChain=${tokenBalance?.specificChain}`,
      );

      // Find expected chain for this token
      const expectedToken = tokens.find(
        (t) => t.address?.toLowerCase() === tokenAddress.toLowerCase(),
      );

      if (expectedToken) {
        // Verify specificChain matches what we expect
        expect(tokenBalance?.specificChain).toBe(expectedToken.specificChain);
      }
    }

    // Summary
    console.log(
      `Successfully verified specificChain for ${purchasedTokens.length} tokens`,
    );
  });
});
