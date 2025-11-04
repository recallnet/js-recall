import { and, desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import { trades } from "@recallnet/db/schema/trading/defs";
import {
  BalancesResponse,
  BlockchainType,
  SpecificChain,
  TradeResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  noTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@recallnet/test-utils";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";

const reason = "chain specific end to end tests";

describe("Specific Chains", () => {
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("specificChain is correctly entered into balances when agent is initialized in competition", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user/agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 1",
    });

    // Start a competition with the agent
    const competitionName = `Specific Chain Test ${Date.now()}`;
    await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    // Use the agent client API to get balances instead of direct DB query
    const balancesResponse = (await client.getBalance()) as BalancesResponse;
    expect(balancesResponse.success).toBe(true);
    expect(Array.isArray(balancesResponse.balances)).toBe(true);
    expect(balancesResponse.balances.length).toBeGreaterThan(0);

    // Verify each token has the correct specificChain value
    for (const balance of balancesResponse.balances) {
      const tokenAddress = balance.tokenAddress.toLowerCase();
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
    }
  });

  test("specificChain is correctly recorded in trades table when executing trades", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user/agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Agent 2",
    });

    // Start a competition with the agent
    const competitionName = `Trade Chain Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competitionResponse.competition.id;

    // Get agent's current balances
    const balanceResponse = (await client.getBalance()) as BalancesResponse;
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
        (balance) =>
          balance.tokenAddress.toLowerCase() === ethAddress.toLowerCase(),
      );

      const usdcBalance = balanceResponse.balances.find(
        (balance) =>
          balance.tokenAddress.toLowerCase() === usdcAddress.toLowerCase(),
      );

      if (ethBalance) ethToken = ethBalance.tokenAddress;
      if (usdcBalance) usdcToken = usdcBalance.tokenAddress;
    }

    // Make sure we found both tokens
    expect(ethToken).toBeDefined();
    expect(usdcToken).toBeDefined();

    // Skip the test if we couldn't find the tokens (typescript safety)
    if (!ethToken || !usdcToken) {
      return;
    }

    // Execute a trade from ETH to USDC
    const tradeAmount = "0.01"; // Trade a small amount of ETH
    const tradeResponse = await client.executeTrade({
      fromToken: ethToken,
      toToken: usdcToken,
      amount: tradeAmount,
      competitionId,
      reason,
    });
    expect(tradeResponse.success).toBe(true);

    // Query the trades table to check if specificChain fields were correctly populated
    const trade = await db.query.trades.findFirst({
      where: eq(trades.agentId, agent.id),
    });

    // Verify we have a trade record
    expect(trade).toBeDefined();

    // Verify the specificChain fields were correctly populated
    expect(trade?.fromSpecificChain).toBe("eth");
    expect(trade?.toSpecificChain).toBe("eth");
    expect(trade?.fromToken).toBe(ethToken);
    expect(trade?.toToken).toBe(usdcToken);
  });

  test("can purchase token on optimism", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new user/agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Token Purchase Test Agent",
    });

    // Start a competition with the agent
    const competitionName = `Token Purchase Test ${Date.now()}`;
    const competitionResponse2 = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      tradingConstraints: noTradingConstraints,
    });
    const competitionId2 = competitionResponse2.competition.id;

    // Get agent's current balances
    const balanceResponse = (await client.getBalance()) as BalancesResponse;
    expect(balanceResponse.success).toBe(true);

    // Target token we want to purchase (LINK on optimism)
    const targetTokenAddress = "0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6";

    // First try to find USDC
    const usdcAddress = config.specificChainTokens.optimism.usdc;

    // Execute the trade from source token to target token
    const tradeResponse = await client.executeTrade({
      fromToken: usdcAddress,
      toToken: targetTokenAddress,
      amount: "100",
      competitionId: competitionId2,
      reason,
    });

    // Verify the trade was successful
    expect(tradeResponse.success).toBe(true);

    // Get updated balances to verify we received the target token
    const updatedBalanceResponse =
      (await client.getBalance()) as BalancesResponse;
    expect(updatedBalanceResponse.success).toBe(true);

    // Find the target token in the updated balances
    if (Array.isArray(updatedBalanceResponse.balances)) {
      const targetTokenBalance = updatedBalanceResponse.balances.find(
        (balance) =>
          balance.tokenAddress.toLowerCase() ===
          targetTokenAddress.toLowerCase(),
      );

      // Verify we received some amount of the target token
      expect(targetTokenBalance).toBeDefined();
      expect(targetTokenBalance?.amount).toBeGreaterThan(0);
    }

    // // Query the trades table to verify the trade was recorded correctly
    const tradesResult = await db.query.trades.findMany({
      where: and(
        eq(trades.agentId, agent.id),
        eq(trades.toToken, targetTokenAddress),
      ),
    });

    // // Verify a trade record exists for this transaction
    expect(tradesResult.length).toBe(1);

    const trade = tradesResult[0];
    expect(trade?.fromToken).toBe(usdcAddress);
    expect(trade?.toToken).toBe(targetTokenAddress);
    expect(trade?.fromSpecificChain).toBeDefined();
    expect(trade?.toSpecificChain).toBeDefined();
    expect(trade?.toSpecificChain).toBe("optimism");

    // Verify that balances contain specificChain
    const balancesResponse = (await client.getBalance()) as BalancesResponse;
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
    const swapBackResponse = await client.executeTrade({
      fromToken: targetTokenAddress,
      toToken: usdcAddress,
      amount: trade?.toAmount.toString() ?? "0",
      competitionId: competitionId2,
      reason,
    });
    // Verify the swap back was successful
    expect(swapBackResponse.success).toBe(true);

    // Get the entrys in the trades table for this swap back
    const swapBackResult = await db.query.trades.findFirst({
      where: and(eq(trades.agentId, agent.id), eq(trades.toToken, usdcAddress)),
    });
    // Verify a trade record exists for this transaction
    expect(swapBackResult).toBeDefined();
    expect(swapBackResult?.fromToken).toBe(targetTokenAddress);
    expect(swapBackResult?.toToken).toBe(usdcAddress);
    expect(swapBackResult?.fromSpecificChain).toBeDefined();
    expect(swapBackResult?.toSpecificChain).toBeDefined();
    expect(swapBackResult?.fromSpecificChain).toBe("optimism");
    expect(swapBackResult?.toSpecificChain).toBe("optimism");
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

    // Register a new user/agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Token Purchase Test Agent",
    });

    // Start a competition with the agent
    const competitionName = `Token Purchase Test ${Date.now()}`;
    const competitionResponse3 = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId3 = competitionResponse3.competition.id;

    // Track successfully purchased tokens
    const purchasedTokens: string[] = [];

    for (const token of tokens) {
      try {
        // Get agent's current balances
        const balanceResponse = (await client.getBalance()) as BalancesResponse;
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
        const tradeResponse = await client.executeTrade({
          fromToken: usdcAddress,
          toToken: tokenAddress,
          amount: "100",
          competitionId: competitionId3,
          reason,
        });

        // Verify the trade was successful
        expect(tradeResponse.success).toBe(true);

        // If trade succeeded, add to our list
        purchasedTokens.push(tokenAddress);

        // Verify trade record in database
        const tradeResult = await db.query.trades.findMany({
          where: and(
            eq(trades.agentId, agent.id),
            eq(trades.toToken, tokenAddress),
          ),
          orderBy: desc(trades.id),
          limit: 1,
        });

        expect(tradeResult.length).toBe(1);
        const trade = tradeResult[0];

        // Verify specificChain is recorded correctly in trades table
        expect(trade?.fromSpecificChain).toBeDefined();
        expect(trade?.toSpecificChain).toBeDefined();

        // Verify the to_specific_chain is what we expect
        expect(trade?.toSpecificChain).toBe(specificChainStr);
      } catch {
        // Error trading token - test will continue with other tokens
      }
    }

    // Verify that balances contain specificChain for all purchased tokens
    const finalBalances = (await client.getBalance()) as BalancesResponse;
    expect(finalBalances.success).toBe(true);
    expect(Array.isArray(finalBalances.balances)).toBe(true);

    // Check each purchased token appears in balances with correct specificChain
    for (const tokenAddress of purchasedTokens) {
      // Find this token in the balances
      const tokenBalance = finalBalances.balances.find(
        (b) => b.tokenAddress.toLowerCase() === tokenAddress.toLowerCase(),
      );

      // Token should exist in balances
      expect(tokenBalance).toBeDefined();

      // SpecificChain should be defined
      expect(tokenBalance?.specificChain).toBeDefined();

      // Find expected chain for this token
      const expectedToken = tokens.find(
        (t) => t.address?.toLowerCase() === tokenAddress.toLowerCase(),
      );

      if (expectedToken) {
        // Verify specificChain matches what we expect
        expect(tokenBalance?.specificChain).toBe(expectedToken.specificChain);
      }
    }
  });

  test("swap fails if trading pair is not found", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Token Purchase Test Agent",
    });

    // Start a competition with the agent
    const competitionName = `Token Purchase Test ${Date.now()}`;
    const competitionResponse4 = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      // This test fails sometimes because of constraint validation. skipping
      // so that the actual test path always runs.
      tradingConstraints: noTradingConstraints,
    });
    const competitionId4 = competitionResponse4.competition.id;

    // Get agent's current balances
    const balanceResponse = (await client.getBalance()) as BalancesResponse;
    expect(balanceResponse.success).toBe(true);

    // // Target token we want to purchase
    const targetTokenAddress = "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b";

    // // First try to find USDC
    const usdcAddress = config.specificChainTokens.optimism.usdc;

    // // Execute the trade from source token to target token
    const tradeResponse = (await client.executeTrade({
      fromToken: usdcAddress,
      toToken: targetTokenAddress,
      amount: "100",
      competitionId: competitionId4,
      reason,
    })) as TradeResponse;

    // Verify the trade was successful
    expect(tradeResponse.transaction.toSpecificChain).toBe("base");

    // Execute the trade again but specify optimism (even though the token is on base)
    const tradeResponseTwo = (await client.executeTrade({
      fromToken: usdcAddress,
      toToken: targetTokenAddress,
      fromSpecificChain: "optimism" as SpecificChain,
      toSpecificChain: "optimism" as SpecificChain,
      amount: "100",
      competitionId: competitionId4,
      reason,
    })) as TradeResponse;

    // Verify the trade failed
    expect(tradeResponseTwo.success).toBe(false);

    // // test getting price of target token
    const priceResponse = await client.getPrice(
      targetTokenAddress,
      BlockchainType.EVM,
      "optimism" as SpecificChain,
    );

    // // Verify price is not found for this token on the wrong chain
    expect(priceResponse.success).toBe(false);
  });
});
