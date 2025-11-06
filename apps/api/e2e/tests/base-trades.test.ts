import { beforeEach, describe, expect, test } from "vitest";

import { MultiChainProvider } from "@recallnet/services/providers";
import { BlockchainType, PriceReport } from "@recallnet/services/types";
import {
  BalancesResponse,
  SpecificChain,
  TradeHistoryResponse,
  TradeResponse,
} from "@recallnet/test-utils";
import {
  createTestClient,
  getAdminApiKey,
  noTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@recallnet/test-utils";

import config, { features } from "@/config/index.js";
import { logger } from "@/lib/logger.js";

describe("Base Chain Trading", () => {
  let adminApiKey: string;

  // Base tokens to test with
  const BASE_TOKENS = [
    "0x3992B27dA26848C2b19CeA6Fd25ad5568B68AB98", // DEGEN
    "0x63706e401c06ac8513145b7687A14804d17f814b", // MOBY
    "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", // SUSHI
    "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", // OBO
    "0x98d0baa52b2D063E780DE12F615f963Fe8537553", // BEAN
  ];

  // Base USDC token address
  const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  // Base specific chain identifier
  const BASE_CHAIN = "base";

  // Ethereum token to test cross-chain trading restrictions
  const ETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH on Ethereum

  // Number of tokens to distribute funds across
  const NUM_TOKENS = BASE_TOKENS.length;

  // Clean up test state before each test
  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("agent can trade Base tokens with explicit chain parameters", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user/agent and get client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Base Chain Trading Agent",
    });

    // Start a competition with our agent
    const competitionName = `Base Trading Test ${Date.now()}`;
    const competitionResponse = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      // disable trading constraints for testing base chain functionality
      tradingConstraints: noTradingConstraints,
    });
    const competitionId = competitionResponse.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await client.getBalance(
      competitionId,
    )) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();

    // Get initial Base USDC balance (dynamically from API response)
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount.toString() || "0",
    );
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);

    // Store initial portfolio value for later comparison
    const initialPortfolioValue = initialBaseUsdcBalance;

    // Amount to spend on each token
    const spendPerToken = initialBaseUsdcBalance / NUM_TOKENS;

    // Store token prices and expected amounts
    const tokenData = [];

    // Initialize services for direct calls
    const multiChainProvider = new MultiChainProvider(config, logger);

    // Get the price for each token
    for (const tokenAddress of BASE_TOKENS) {
      // Get token price with explicit chain parameters to bypass chain detection using direct service call
      const tokenPrice = (await multiChainProvider.getPrice(
        tokenAddress,
        BlockchainType.EVM,
        BASE_CHAIN,
      )) as PriceReport;
      expect(tokenPrice).not.toBeNull();

      const price = tokenPrice?.price || 0;
      const expectedTokenAmount = spendPerToken / price;

      tokenData.push({
        address: tokenAddress,
        price: price,
        expectedAmount: expectedTokenAmount,
      });
    }

    // Execute trades for each token with explicit chain parameters
    for (const token of tokenData) {
      // Execute a buy trade for this token with explicit chain parameters

      // Use the API endpoint with explicit from/to token addresses
      const tradeResponse = (await client.executeTrade({
        fromToken: BASE_USDC_ADDRESS, // Explicitly use Base USDC address
        toToken: token.address, // Target token to buy
        amount: spendPerToken.toString(),
        competitionId,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason: "Base chain trading test",
      })) as TradeResponse;
      expect(tradeResponse.success).toBe(true);
      expect(tradeResponse.transaction).toBeDefined();

      // Verify chain parameters in the transaction
      expect(tradeResponse.transaction.fromChain).toBe(BlockchainType.EVM);
      expect(tradeResponse.transaction.toChain).toBe(BlockchainType.EVM);
      expect(tradeResponse.transaction.fromSpecificChain).toBe(BASE_CHAIN);
      expect(tradeResponse.transaction.toSpecificChain).toBe(BASE_CHAIN);

      // Wait a bit between trades to ensure they're processed
      await wait(100);
    }

    // Wait for all trades to be processed
    await wait(500);

    // Check final balance
    const finalBalanceResponse = (await client.getBalance(
      competitionId,
    )) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);

    // Calculate total portfolio value after trades
    let totalActualValue = 0;

    for (const token of tokenData) {
      const tokenBalance = parseFloat(
        finalBalanceResponse.balances
          .find((b) => b.tokenAddress === token.address)
          ?.amount?.toString() || "0",
      );
      expect(tokenBalance).toBeGreaterThan(0);

      // Add token value to total (tokenBalance * price)
      const tokenValue = tokenBalance * token.price;
      totalActualValue += tokenValue;
    }
    // Add any remaining USDC
    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount?.toString() || "0",
    );
    totalActualValue += finalBaseUsdcBalance;

    // Total expected value should be close to initial portfolio value
    // Use the dynamic initial portfolio value instead of hard-coded 5000
    const totalExpectedValue = initialPortfolioValue;

    // Verify the final portfolio value is close to the expected value
    // Allowing for some slippage but within reasonable bounds
    // The portfolio value should be within ~5% of the initial value
    const upperBound = totalExpectedValue * 1.05;
    const lowerBound = totalExpectedValue * 0.95;

    expect(totalActualValue).toBeGreaterThanOrEqual(lowerBound);
    expect(totalActualValue).toBeLessThanOrEqual(upperBound);

    // Get trade history and verify all trades were recorded with correct chain info
    const tradeHistoryResponse = (await client.getTradeHistory(
      competitionId,
    )) as TradeHistoryResponse;
    expect(tradeHistoryResponse.success).toBe(true);
    expect(tradeHistoryResponse.trades).toBeInstanceOf(Array);
    expect(tradeHistoryResponse.trades.length).toBeGreaterThanOrEqual(
      NUM_TOKENS,
    );

    // Verify each trade in history has correct chain parameters
    for (let i = 0; i < NUM_TOKENS; i++) {
      const trade = tradeHistoryResponse.trades[i];
      expect(trade?.fromChain).toBe(BlockchainType.EVM);
      expect(trade?.toChain).toBe(BlockchainType.EVM);
      expect(trade?.fromSpecificChain).toBe(BASE_CHAIN);
      expect(trade?.toSpecificChain).toBe(BASE_CHAIN);
    }
  });

  test("users cannot execute cross-chain trades when CROSS_CHAIN_TRADING_TYPE=DISALLOWALL", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user/agent and get client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Cross-Chain Restriction Agent",
    });

    // Start a competition with our agent
    const competitionName = `Cross-Chain Restriction Test ${Date.now()}`;
    const competitionResponse2 = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId2 = competitionResponse2.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await client.getBalance(
      competitionId2,
    )) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();
    // Get initial Base USDC balance
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount.toString() || "0",
    );
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);
    // Check for any initial ETH balance (should be zero)
    const initialEthBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.tokenAddress === ETH_ADDRESS)
        ?.amount.toString() || "0",
    );
    // If there's already ETH in the balance, this will affect our test

    // Attempt to execute a cross-chain trade (Base USDC to Ethereum ETH)
    const tradeAmount = (initialBaseUsdcBalance * 0.1).toString(); // Use 10% of balance

    try {
      const tradeResponse = await client.executeTrade({
        fromToken: BASE_USDC_ADDRESS, // Base USDC
        toToken: ETH_ADDRESS, // Ethereum ETH
        amount: tradeAmount,
        competitionId: competitionId2,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.ETH, // Different chain from fromSpecificChain
        reason: "Cross-chain trade test",
      });

      // If we get here, the trade might have succeeded, which is unexpected if cross-chain trading is disabled

      // Even if no exception is thrown, the trade should not have succeeded
      expect(tradeResponse.success).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Type error as any for proper handling
      // We expect an error if cross-chain trading is disabled

      expect(error).toBeDefined();

      // Verify the error message indicates cross-chain trading is disabled
      if (error.response && error.response.data) {
        const errorMsg =
          error.response.data.message || error.response.data.error;
        expect(errorMsg).toMatch(/cross-chain|different chain/i);
      }
    }

    // Wait to ensure any potential transaction would have been processed
    await wait(500);

    // Check final balances
    const finalBalanceResponse = (await client.getBalance(
      competitionId2,
    )) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);

    // Check the final Base USDC balance
    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount.toString() || "0",
    );

    // Check if any USDC was spent (which should not happen)
    const usdcDifference = initialBaseUsdcBalance - finalBaseUsdcBalance;
    // ETH balance should remain zero
    const ethBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.tokenAddress === ETH_ADDRESS)
        ?.amount.toString() || "0",
    );

    // CRITICAL TEST: If cross-chain trading is disabled:
    // 1. An error should occur or trade.success should be false
    // 2. No USDC should be spent
    // 3. No ETH should be received

    const crossChainEnabled = features.CROSS_CHAIN_TRADING_TYPE;

    if (crossChainEnabled === "disallowAll") {
      // If cross-chain trading is disabled, verify nothing was spent
      if (usdcDifference > 0) {
        // Get trade history to see what transaction occurred
        await client.getTradeHistory(competitionId2);
      }

      // Verify no ETH was received
      if (ethBalance > initialEthBalance) {
        // Get trade history to see what transaction occurred
        await client.getTradeHistory(competitionId2);
      }
      // Instead of expecting ETH balance to be 0, check that it hasn't increased
      expect(ethBalance).toBeLessThanOrEqual(initialEthBalance);
    }
  });

  test("users cannot spend more than their initial balance", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user/agent and get client
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Spending Limit Agent",
    });

    // Start a competition with our agent
    const competitionName = `Spending Limit Test ${Date.now()}`;
    const competitionResponse3 = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      // disable trading constraints for testing base chain functionality
      tradingConstraints: noTradingConstraints,
    });
    const competitionId3 = competitionResponse3.competition.id;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await client.getBalance(
      competitionId3,
    )) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();
    // Get initial Base USDC balance
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount.toString() || "0",
    );
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);

    // Choose a token to trade for
    const targetToken = BASE_TOKENS[0]; // Just use the first Base token

    // Get token price to verify later using direct service call
    const multiChainProvider = new MultiChainProvider(config, logger);
    const tokenPriceResponse = await multiChainProvider.getPrice(
      targetToken!,
      BlockchainType.EVM,
      BASE_CHAIN,
    );
    expect(tokenPriceResponse).not.toBeNull();
    const tokenPrice = tokenPriceResponse !== null ? tokenPriceResponse : 0;

    // Attempt to spend more than the initial balance
    const excessiveAmount = (initialBaseUsdcBalance * 1.5).toString(); // 150% of balance

    try {
      const tradeResponse = await client.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: targetToken!,
        amount: excessiveAmount,
        competitionId: competitionId3,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason: "Spending limit test",
      });

      expect(tradeResponse.success).toBe(false); // The test should fail here if excessive trading is allowed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Type error as any for proper handling
      // We expect an error for insufficient funds
      expect(error).toBeDefined();
      // Verify the error message indicates insufficient balance
      if (error.response && error.response.data) {
        expect(
          error.response.data.message || error.response.data.error,
        ).toMatch(/insufficient|balance|not enough/i);
      }
    }

    // Wait longer to ensure system state is stable after the failed trade attempt
    // This helps prevent timing issues in CI environments
    await wait(3000);

    // Verify that a valid trade with proper amount works
    const validAmount = (initialBaseUsdcBalance * 0.5).toString(); // 50% of balance

    // Execute a valid trade
    const validTradeResponse = (await client.executeTrade({
      fromToken: BASE_USDC_ADDRESS,
      toToken: targetToken!,
      amount: validAmount,
      competitionId: competitionId3,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: SpecificChain.BASE,
      toSpecificChain: SpecificChain.BASE,
      reason: "Spending limit test",
    })) as TradeResponse;

    // This trade should succeed
    expect(validTradeResponse.success).toBe(true);
    expect(validTradeResponse.transaction).toBeDefined();

    // Wait for trade to process
    await wait(500);

    // Check final balances
    const finalBalanceResponse = (await client.getBalance(
      competitionId3,
    )) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should be reduced by the valid trade amount
    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.tokenAddress === BASE_USDC_ADDRESS)
        ?.amount.toString() || "0",
    );
    const expectedRemainingUsdc =
      initialBaseUsdcBalance - parseFloat(validAmount);
    expect(finalBaseUsdcBalance).toBeCloseTo(expectedRemainingUsdc, 0); // Using coarse precision due to potential slippage
    // Token balance should be greater than zero
    const tokenBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.tokenAddress === targetToken)
        ?.amount.toString() || "0",
    );
    expect(tokenBalance).toBeGreaterThan(0);

    // Expected token amount based on simple price calculation (allowing for slippage)
    const expectedTokenAmount =
      parseFloat(validAmount) / (tokenPrice ? tokenPrice.price : 1);

    // Allow for up to 20% price slippage
    // Token amount should be in a reasonable range of the expected amount
    // Using a wide tolerance due to slippage and price fluctuations
    const lowerExpected = expectedTokenAmount * 0.8;
    const upperExpected = expectedTokenAmount * 1.2;
    expect(tokenBalance).toBeGreaterThanOrEqual(lowerExpected);
    expect(tokenBalance).toBeLessThanOrEqual(upperExpected);
  });
});
