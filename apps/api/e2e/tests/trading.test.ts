import { randomUUID } from "crypto";
import { beforeEach, describe, expect, test } from "vitest";

import { trades as tradesDef } from "@recallnet/db/schema/trading/defs";
import { InsertTrade } from "@recallnet/db/schema/trading/types";
import {
  BalancesResponse,
  BlockchainType,
  CROSS_CHAIN_TRADING_TYPE,
  CompetitionRulesResponse,
  ErrorResponse,
  PriceResponse,
  QuoteResponse,
  SpecificChain,
  StartCompetitionResponse,
  TokenBalance,
  TradeHistoryResponse,
  TradeResponse,
  TradeTransaction,
  createTestClient,
  getAdminApiKey,
  looseTradingConstraints,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
} from "@recallnet/test-utils";

import config from "@/config/index.js";
import { db } from "@/database/db.js";
import { ServiceRegistry } from "@/services/index.js";

const reason = "trading end-to-end test";

describe("Trading API", () => {
  const services = new ServiceRegistry();

  let adminApiKey: string;

  beforeEach(async () => {
    // Store the admin API key for authentication
    adminApiKey = await getAdminApiKey();
  });

  test("should handle case-insensitive token addresses in trades", async () => {
    // Register user and agent
    const { client, agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Case Test Agent",
    });

    // Start competition
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const startResp = await startTestCompetition({
      adminClient,
      name: `Case Sensitivity Test ${Date.now()}`,
      agentIds: [agent.id],
      tradingConstraints: looseTradingConstraints,
    });
    expect(startResp.success).toBe(true);
    const competitionId = startResp.competition.id;

    // Get agent's balances to see what case addresses are stored as
    const balancesResp = (await client.getBalance(
      competitionId,
    )) as BalancesResponse;
    expect(balancesResp.success).toBe(true);

    // Find Ethereum USDC balance (should have 5000 from config)
    const ethUsdcBalance = balancesResp.balances.find(
      (b) =>
        b.specificChain === "eth" &&
        b.symbol?.toUpperCase() === "USDC" &&
        b.amount > 0,
    );
    expect(ethUsdcBalance).toBeDefined();
    expect(ethUsdcBalance?.amount).toBeGreaterThan(100);
    expect(ethUsdcBalance?.tokenAddress).toBeDefined();

    const storedAddress = ethUsdcBalance?.tokenAddress ?? "";
    const lowercaseAddress = storedAddress.toLowerCase();

    // Try to trade using LOWERCASE version of the address
    // This should work (Ethereum addresses are case-insensitive)
    const tradeResp = await client.executeTrade({
      fromToken: lowercaseAddress, // Using lowercase
      toToken: config.specificChainTokens.eth.eth, // WETH
      amount: "50",
      competitionId,
      reason: "Test: lowercase address should work",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: "eth" as SpecificChain,
      toSpecificChain: "eth" as SpecificChain,
    });

    // Expect trade to succeed (case-insensitive lookups)
    expect(tradeResp.success).toBe(true);

    const successResp = tradeResp as TradeResponse;
    expect(successResp.transaction).toBeDefined();
    expect(successResp.transaction.success).toBe(true);
    expect(successResp.transaction.fromToken).toBe(lowercaseAddress);

    // Verify balance was actually deducted
    const balancesAfter = (await client.getBalance(
      competitionId,
    )) as BalancesResponse;
    const ethUsdcAfter = balancesAfter.balances.find(
      (b) => b.specificChain === "eth" && b.symbol?.toUpperCase() === "USDC",
    );
    expect(ethUsdcAfter).toBeDefined();
    expect(ethUsdcAfter?.amount).toBeLessThan(ethUsdcBalance?.amount ?? 0);
  });

  test("agent can execute a trade and verify balance updates", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Trading Agent",
      });

    // Start a competition with our agent
    const competitionName = `Trading Test ${Date.now()}`;
    const competitionResponse = (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    const competitionId = competitionResponse.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect((initialBalanceResponse as BalancesResponse).success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // Verify token symbols are included
    expect(
      (buyTradeResponse as TradeResponse).transaction.fromTokenSymbol,
    ).toBeDefined();
    expect(
      (buyTradeResponse as TradeResponse).transaction.toTokenSymbol,
    ).toBeDefined();

    // Verify chain field is included in transaction response
    const buyTransaction = (buyTradeResponse as TradeResponse).transaction;
    expect(buyTransaction.fromChain).toBeDefined();
    expect(buyTransaction.fromChain).toBe(BlockchainType.SVM);
    expect(buyTransaction.toChain).toBeDefined();
    expect(buyTransaction.toChain).toBe(BlockchainType.SVM);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    expect(updatedBalanceResponse.success).toBe(true);

    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades,
    ).toBeInstanceOf(Array);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify chain fields in trades if they exist
    const lastTradeItem = (tradeHistoryResponse as TradeHistoryResponse)
      .trades[0];
    expect(lastTradeItem).toBeDefined();
    expect(lastTradeItem!.fromChain).toBeDefined();
    expect(lastTradeItem!.fromChain).toBe(BlockchainType.SVM);
    expect(lastTradeItem!.toChain).toBeDefined();
    expect(lastTradeItem!.toChain).toBe(BlockchainType.SVM);

    // Execute a sell trade (selling SOL for USDC)
    // Sell 50% of what we have to ensure we never try to sell more than we have
    const tokenToSell = updatedSolBalance * 0.5;

    const sellTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: tokenToSell.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(sellTradeResponse.success).toBe(true);
    expect((sellTradeResponse as TradeResponse).transaction).toBeDefined();

    // Check final balance
    const finalBalanceResponse = await agentClient.getBalance(competitionId);
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should have increased compared to after buying
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(finalUsdcBalance).toBeGreaterThan(updatedUsdcBalance);
    // SOL balance should have decreased compared to after buying
    const finalSolBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(finalSolBalance).toBeLessThan(updatedSolBalance);
  });

  test("agent can execute a trade with an arbitrary token address", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Arbitrary Token Agent",
      });

    // Start a competition with our agent
    const competitionName = `Arbitrary Token Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // The arbitrary token address to test with (Raydium)
    const raydiumTokenAddress = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === raydiumTokenAddress)
        ?.amount.toString() || "0",
    );

    // Execute a direct trade using the API's expected parameters
    // We'll use the executeTrade method but we need to correctly map the parameters
    const tradeAmount = 10; // 10 USDC
    // Use the client's executeTrade which expects fromToken and toToken
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: raydiumTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(buyTradeResponse.success).toBe(true);
    const tradeResponse = buyTradeResponse as TradeResponse;
    expect(tradeResponse.transaction).toBeDefined();
    expect(tradeResponse.transaction.id).toBeDefined();

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    expect(initialUsdcBalance - updatedUsdcBalance).toBeCloseTo(tradeAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased
    const updatedArbitraryTokenBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === raydiumTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedArbitraryTokenBalance).toBeGreaterThan(
      initialArbitraryTokenBalance,
    );

    // Get trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades,
    ).toBeInstanceOf(Array);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify the last trade has the correct tokens
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    expect(lastTrade?.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade?.toToken).toBe(raydiumTokenAddress);
    expect((lastTrade as TradeTransaction)?.fromAmount).toBeCloseTo(
      tradeAmount,
      1,
    ); // Allow for small rounding differences
  });

  test("agent cannot execute invalid trades", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Invalid Trading Agent",
      });

    // Start a competition with our agent
    const competition = await startTestCompetition({
      adminClient,
      name: `Invalid Trading Test ${Date.now()}`,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );

    // Try to execute a trade with invalid token address format
    const invalidTokenResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: "InvalidTokenAddressFormat123", // This should be rejected by the API as not a valid token address format
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(invalidTokenResponse.success).toBe(false);

    // Try to execute a trade with a completely made-up token address that uses a valid format but doesn't exist
    // Using a completely invalid but properly formatted address that will never have a price
    const nonExistentTokenAddress =
      "1111111111111111111111111111111111111111111111111111";

    const noPriceTokenResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: nonExistentTokenAddress,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(noPriceTokenResponse.success).toBe(false);
    expect((noPriceTokenResponse as ErrorResponse).error).toContain(
      "Unable to determine price",
    );

    // Try to execute a trade with amount exceeding balance
    const excessiveAmountResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: usdcTokenAddress, // Use USDC which has a known price
      amount: (initialUsdcBalance * 2).toString(), // Double the available balance
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(excessiveAmountResponse.success).toBe(false);
    expect((excessiveAmountResponse as ErrorResponse).error).toContain(
      "Cannot trade between identical tokens",
    );
    // Get fresh balances to calculate current portfolio value after trade attempts
    const balancesResponse = await agentClient.getBalance(competitionId);
    expect(balancesResponse.success).toBe(true);
    const balances = (balancesResponse as BalancesResponse).balances;
    const portfolioValue = balances.reduce(
      (sum, balance) => sum + (balance.value || 0),
      0,
    );
    // Test insufficient balance with an amount below max trade percentage but above actual balance
    // Calculate 25% of portfolio value (below the 30% max trade limit) but ensure it exceeds the USDC balance
    const insufficientBalanceAmount = Math.max(
      initialUsdcBalance * 1.1,
      Math.min(portfolioValue * 0.25, initialUsdcBalance * 1.5),
    );

    // Check if this amount is actually greater than our balance but less than max trade percentage
    // Add a test for truly excessive amounts after fixing the token address
    // The test should now execute a transaction where from != to
    const solanaPriceResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: insufficientBalanceAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(solanaPriceResponse.success).toBe(false);
    expect((solanaPriceResponse as ErrorResponse).error).toContain(
      "Insufficient balance",
    );

    // Try to execute a sell trade without having tokens
    const invalidSellResponse = await agentClient.executeTrade({
      fromToken: config.specificChainTokens.svm.sol, // Use SOL which we don't have in our balance
      toToken: usdcTokenAddress,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(invalidSellResponse.success).toBe(false);
    expect((invalidSellResponse as ErrorResponse).error).toContain(
      "Insufficient balance",
    );
  });

  test("cannot place a trade that exceeds the maximum amount", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Max Trade Limit Agent",
      });

    // Start a competition with our agent
    const competition = await startTestCompetition({
      adminClient,
      name: `Max Trade Limit Test ${Date.now()}`,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Check initial balance
    const initialBalanceResponse = (await agentClient.getBalance(
      competitionId,
    )) as BalancesResponse;

    const usdcTokenAddress = config.specificChainTokens.svm.usdc;

    // First, check if we have any SOL or other tokens and sell them to consolidate into USDC
    const tokenAddressesBefore = Object.keys(initialBalanceResponse.balances);

    // Consolidate all non-USDC SVM tokens into USDC
    for (const tokenAddress of tokenAddressesBefore) {
      // Skip USDC itself
      if (tokenAddress === usdcTokenAddress) continue;

      // Only consolidate Solana (SVM) tokens - we want to avoid cross-chain trades
      const tokenChain =
        services.priceTrackerService.determineChain(tokenAddress);
      if (tokenChain !== BlockchainType.SVM) {
        continue;
      }

      const balance = parseFloat(
        initialBalanceResponse.balances
          .find((b) => b.tokenAddress === tokenAddress)
          ?.amount.toString() || "0",
      );

      // If we have a balance, sell it for USDC
      if (balance > 0) {
        const consolidateResponse = await agentClient.executeTrade({
          fromToken: tokenAddress,
          toToken: usdcTokenAddress,
          amount: balance.toString(),
          competitionId,
          fromChain: BlockchainType.SVM,
          toChain: BlockchainType.SVM,
          reason,
        });

        expect(consolidateResponse.success).toBe(true);
      }
    }

    // // Verify we now have a consolidated USDC balance
    const balanceAfterConsolidation =
      await agentClient.getBalance(competitionId);
    const consolidatedUsdcBalance = parseFloat(
      (balanceAfterConsolidation as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(consolidatedUsdcBalance).toBeGreaterThan(0);

    // Try to trade almost all of our USDC balance for SOL
    // This should be over the MAX_TRADE_PERCENTAGE limit (5% in .env.test)
    const tradeAmount = consolidatedUsdcBalance * 0.95; // Use 95% of our USDC

    const maxPercentageResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(maxPercentageResponse.success).toBe(false);
    expect((maxPercentageResponse as ErrorResponse).error).toContain(
      "exceeds maximum size",
    );
  });

  test("agent can fetch price and execute a calculated trade", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Price Calculation Agent",
      });

    // Start a competition with our agent
    const competitionName = `Price Calculation Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
      tradingConstraints: {
        ...looseTradingConstraints,
        minimumLiquidityUsd: 500,
      },
    });
    const competitionId = competition.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // WETH/SOL token address: https://dexscreener.com/solana/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs
    const wethTokenAddress = "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs";

    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === wethTokenAddress)
        ?.amount.toString() || "0",
    );

    // 1. Fetch the price for the arbitrary token
    const priceResponse = await agentClient.getPrice(
      wethTokenAddress,
      BlockchainType.SVM,
      SpecificChain.SVM,
    );
    expect(priceResponse.success).toBe(true);
    expect((priceResponse as PriceResponse).price).toBeDefined();

    const tokenPrice = (priceResponse as PriceResponse).price;
    expect(tokenPrice).toBeGreaterThan(0);

    // 2. Calculate how much of the token can be bought with 10 USDC
    const usdcAmount = 10;
    const expectedTokenAmount = usdcAmount / (tokenPrice || 0); // Handle null case

    // 3. Execute the trade (buy the token with 10 USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: wethTokenAddress,
      amount: usdcAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // 4. Check final balance and validate it reflects the calculation
    const finalBalanceResponse = await agentClient.getBalance(competitionId);
    expect(finalBalanceResponse.success).toBe(true);
    expect((finalBalanceResponse as BalancesResponse).balances).toBeDefined();
    // USDC balance should have decreased by 10
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance - finalUsdcBalance).toBeCloseTo(usdcAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased by the calculated amount
    const finalTokenBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === wethTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(finalTokenBalance - initialArbitraryTokenBalance).toBeCloseTo(
      expectedTokenAmount,
      1,
    ); // Allow for small variations due to price fluctuations

    // Get trade history to verify details
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;
    expect(tradeHistory.trades).toBeInstanceOf(Array);
    expect(tradeHistory.trades.length).toBeGreaterThan(0);

    // Verify the trade details in history
    const lastTrade = tradeHistory.trades[0];
    expect(lastTrade?.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade?.toToken).toBe(wethTokenAddress);
    expect(lastTrade?.fromAmount).toBeCloseTo(usdcAmount, 1);
    expect(lastTrade?.toAmount).toBeCloseTo(expectedTokenAmount, 1);
  });

  test("agent can trade with Ethereum tokens", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Ethereum Token Agent",
      });

    // Start a competition with our agent
    const competitionName = `Ethereum Token Test ${Date.now()}`;
    const competitionResponse = (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    })) as StartCompetitionResponse;
    const competitionId = competitionResponse.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);
    const balancesResponse = initialBalanceResponse as BalancesResponse;
    expect(balancesResponse.balances).toBeDefined();

    // Get Ethereum USDC token address from blockchain tokens config
    const ethUsdcTokenAddress = config.specificChainTokens.eth.usdc;
    expect(ethUsdcTokenAddress).toBeTruthy();

    // Get Ethereum ETH token address
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    expect(ethTokenAddress).toBeTruthy();

    // First check price to verify EVM tokens are working
    const priceResponse = await agentClient.getPrice(ethTokenAddress);

    // If we get a successful response, verify the token is recognized as EVM
    expect((priceResponse as PriceResponse).chain).toBe(BlockchainType.EVM);

    // Check if we have any ETH balance already
    const initialEthBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === ethTokenAddress)
        ?.amount.toString() || "0",
    );

    // If we have SVM USDC, we can try to trade it for ETH
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const svmUsdcBalance = parseFloat(
      balancesResponse.balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );

    // Ensure we have sufficient balance for trading
    expect(svmUsdcBalance).toBeGreaterThan(0);

    // Use a small amount for the test
    const tradeAmount = Math.min(100, svmUsdcBalance * 0.1);

    // Execute a buy trade (buying ETH with USDC)
    const buyTradeResponse = (await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason,
    })) as TradeResponse;

    expect(buyTradeResponse.success).toBe(true);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    // ETH balance should have increased
    const updatedEthBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === ethTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedEthBalance).toBeGreaterThan(initialEthBalance);

    // Get trade history and verify the Ethereum trade
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify the last trade details
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    expect(lastTrade?.toToken).toBe(ethTokenAddress);

    // Verify chain fields if they exist
    expect(lastTrade?.toChain).toBeDefined();
    expect(lastTrade!.toChain).toBe(BlockchainType.EVM);
  });

  test("agent can execute trades with explicit chain parameters", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Chain-Specific Trading Agent",
      });

    // Start a competition with our agent
    const competitionName = `Chain-Specific Trading Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );

    // The amount to trade
    const tradeAmount = 50;

    // Execute a buy trade with explicit Solana chain parameters
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();

    // Verify chain field is included in the transaction
    expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(
      BlockchainType.SVM,
    );
    expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(
      BlockchainType.SVM,
    );

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history and verify chain info is preserved
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    // Get the most recent trade
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];

    // Verify chain fields in the trade history
    expect(lastTrade?.fromChain).toBe(BlockchainType.SVM);
    expect(lastTrade?.toChain).toBe(BlockchainType.SVM);

    // Test cross-chain trading validation when disabled
    // Get Ethereum ETH token address
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    expect(ethTokenAddress).toBeTruthy();

    // Attempt to execute a cross-chain trade with explicit chain parameters
    // This should fail because cross-chain trading is disabled
    const crossChainTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: SpecificChain.SVM,
      toSpecificChain: SpecificChain.ETH,
      reason,
    });

    expect(crossChainTradeResponse.success).toBe(false);
    expect((crossChainTradeResponse as ErrorResponse).error).toContain(
      "Cross-chain trading is disabled",
    );
  });

  test("agent can execute a trade and verify reason field is returned in responses", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Reason Verification Agent",
      });

    // Start a competition with our agent
    const competitionName = `Reason Verification Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Define a specific reason for the trade
    const specificReason = "Testing reason field persistence and retrieval";

    // Execute a trade with the specific reason
    const tradeResponse = (await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "10",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: specificReason,
    })) as TradeResponse;

    // Verify trade executed successfully
    expect(tradeResponse.success).toBe(true);
    expect(tradeResponse.transaction).toBeDefined();

    // Verify reason is included in the trade execution response
    expect(tradeResponse.transaction.reason).toBe(specificReason);

    // Get trade history
    const tradeHistoryResponse = (await agentClient.getTradeHistory(
      competitionId,
    )) as TradeHistoryResponse;

    // Verify trade history response
    expect(tradeHistoryResponse.success).toBe(true);
    expect(tradeHistoryResponse.trades).toBeInstanceOf(Array);
    expect(tradeHistoryResponse.trades.length).toBeGreaterThan(0);

    // Get the most recent trade (should be the one we just executed)
    const lastTrade = tradeHistoryResponse.trades[0];

    // Verify reason is included in trade history
    expect(lastTrade?.reason).toBe(specificReason);

    // Further verify other trade details match
    expect(lastTrade?.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade?.toToken).toBe(solTokenAddress);
    expect(parseFloat(lastTrade?.fromAmount.toString() || "0")).toBeCloseTo(
      10,
      1,
    );
  });

  test("agent cannot execute a trade without a reason field", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Reason Required Agent",
      });

    // Start a competition with our agent
    const competitionName = `Reason Required Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Attempt to execute a trade without providing a reason field
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "10",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      // reason field intentionally omitted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any); // Using 'as any' to bypass TypeScript checking

    // Verify the trade failed
    expect(tradeResponse.success).toBe(false);

    // Verify the error message indicates that reason is required
    expect((tradeResponse as ErrorResponse).error).toContain("reason");

    // Now execute a trade with reason to verify the endpoint works when reason is provided
    const validTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "10",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Validation test",
    });

    // Verify the trade succeeded when reason is provided
    expect(validTradeResponse.success).toBe(true);
  });

  test("cross-chain trading respects competition settings", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Cross-Chain Settings Agent",
      });

    // Get token addresses for testing
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    expect(ethTokenAddress).toBeTruthy();

    // Start a competition with cross-chain trading DISABLED
    const competitionName = `Cross-Chain Settings Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    const competition1Id = (competitionResponse as StartCompetitionResponse)
      .competition.id;

    expect(competitionResponse.success).toBe(true);

    // Check if competition rules reflect the disabled cross-chain trading
    const rulesResponse = await agentClient.getRules(competition1Id);
    expect(rulesResponse.success).toBe(true);

    // Find cross-chain trading rule in the rules list
    const rules = rulesResponse as CompetitionRulesResponse;
    expect(rules.rules).toBeDefined();
    const crossChainRule = rules.rules.tradingRules.find((rule: string) =>
      rule.includes("Cross-chain trading"),
    );
    expect(crossChainRule).toBeDefined();
    expect(crossChainRule).toContain("disallowAll");

    // Verify that cross-chain trading is actually disabled by attempting a cross-chain trade

    const balanceResponse = await agentClient.getBalance(competition1Id);
    const svmUsdcBalance = parseFloat(
      (balanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );
    const tradeAmount = Math.min(50, svmUsdcBalance * 0.1).toString();

    // Attempt to execute a cross-chain trade (should fail)
    const crossChainTradeResponse = await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount,
      competitionId: competition1Id,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "testing cross-chain trading disabled",
    });

    // Expect the trade to fail due to cross-chain trading being disabled
    expect(crossChainTradeResponse.success).toBe(false);
    expect((crossChainTradeResponse as ErrorResponse).error).toContain(
      "Cross-chain trading is disabled",
    );

    // End the first competition
    await adminClient.endCompetition(
      (competitionResponse as StartCompetitionResponse).competition.id,
    );

    // Start a new competition with cross-chain trading ENABLED
    const secondCompetitionName = `Cross-Chain Enabled Test ${Date.now()}`;
    const secondCompetitionResponse = await adminClient.startCompetition({
      name: secondCompetitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });
    const secondCompetitionId = (
      secondCompetitionResponse as StartCompetitionResponse
    ).competition.id;

    expect(secondCompetitionResponse.success).toBe(true);

    // Check if competition rules reflect the enabled cross-chain trading
    const secondRulesResponse = await agentClient.getRules(secondCompetitionId);
    expect(secondRulesResponse.success).toBe(true);

    // Find cross-chain trading rule in the rules list
    const secondRules = secondRulesResponse as CompetitionRulesResponse;
    expect(secondRules.rules).toBeDefined();
    const secondCrossChainRule = secondRules.rules.tradingRules.find(
      (rule: string) => rule.includes("Cross-chain trading"),
    );
    expect(secondCrossChainRule).toBeDefined();
    expect(secondCrossChainRule).toContain("Cross-chain trading type: allow");

    // Now try to execute a cross-chain trade (should succeed)

    const secondTradeResponse = await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount,
      competitionId: secondCompetitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "testing cross-chain trading enabled",
    });

    // Expect the trade to succeed now that cross-chain trading is enabled
    expect(secondTradeResponse.success).toBe(true);
  });

  test("EVM-to-EVM trades are recognized as cross-chain", async () => {
    // Check if we have at least two EVM chains configured
    const evmChains = Object.keys(config.specificChainTokens).filter(
      (chain) => chain !== "svm" && chain !== "evm",
    );

    expect(evmChains.length).toBeGreaterThanOrEqual(2);

    // Select two different EVM chains for testing
    const sourceChain = config.evmChains[0] as SpecificChain;
    const targetChain = evmChains[1] as SpecificChain;

    // Get USDC addresses for both chains
    const sourceUsdcAddress =
      config.specificChainTokens[
        sourceChain as keyof typeof config.specificChainTokens
      ]?.usdc;
    const targetUsdcAddress =
      config.specificChainTokens[
        targetChain as keyof typeof config.specificChainTokens
      ]?.usdc;

    expect(sourceUsdcAddress).toBeTruthy();
    expect(targetUsdcAddress).toBeTruthy();

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "EVM-to-EVM Cross-Chain Agent",
      });

    // Start a competition with cross-chain trading DISABLED first
    const competitionName = `EVM-EVM Cross-Chain Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    const competitionId = (competitionResponse as StartCompetitionResponse)
      .competition.id;

    expect(competitionResponse.success).toBe(true);

    // Verify the agent has some balance on the source chain
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    const sourceUsdcBalance = parseFloat(
      (initialBalanceResponse.success &&
        (initialBalanceResponse as BalancesResponse).balances
          .find((b) => b.tokenAddress === sourceUsdcAddress)
          ?.amount.toString()) ||
        "0",
    );

    // Ensure we have sufficient balance for the test
    expect(sourceUsdcBalance).toBeGreaterThan(0);

    const tradeAmount = Math.min(10, sourceUsdcBalance * 0.1).toString();

    // Attempt to execute an EVM-to-EVM cross-chain trade when disabled
    const comp1Response2 = await agentClient.executeTrade({
      fromToken: sourceUsdcAddress,
      toToken: targetUsdcAddress,
      amount: tradeAmount,
      competitionId: (competitionResponse as StartCompetitionResponse)
        .competition.id,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: sourceChain,
      toSpecificChain: targetChain,
      reason: "testing EVM-to-EVM cross-chain trading disabled",
    });

    // Expect the trade to fail due to cross-chain trading being disabled
    expect(comp1Response2.success).toBe(false);
    expect((comp1Response2 as ErrorResponse).error).toContain(
      "Cross-chain trading is disabled",
    );

    // End the first competition
    await adminClient.endCompetition(
      (competitionResponse as StartCompetitionResponse).competition.id,
    );

    // Start a new competition with cross-chain trading ENABLED
    const secondCompetitionName = `EVM-EVM Cross-Chain Enabled Test ${Date.now()}`;
    const secondCompetitionResponse = await adminClient.startCompetition({
      name: secondCompetitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });

    expect(secondCompetitionResponse.success).toBe(true);

    // Now try to execute the same EVM-to-EVM cross-chain trade (should succeed)
    const secondTradeResponse = await agentClient.executeTrade({
      fromToken: sourceUsdcAddress,
      toToken: targetUsdcAddress,
      amount: tradeAmount,
      competitionId: (secondCompetitionResponse as StartCompetitionResponse)
        .competition.id,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: sourceChain,
      toSpecificChain: targetChain,
      reason: "testing EVM-to-EVM cross-chain trading enabled",
    });

    // Expect the trade to succeed now that cross-chain trading is enabled
    expect(secondTradeResponse.success).toBe(true);
  });

  test("CrossChainTradingType.disallowXParent allows same-parent-chain trading but blocks cross-parent-chain trading", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "disallowXParent Testing Agent",
      });

    // Start a competition with disallowXParent cross-chain trading setting
    const competitionName = `disallowXParent Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_X_PARENT,
    });
    const competitionId = (competitionResponse as StartCompetitionResponse)
      .competition.id;

    expect(competitionResponse.success).toBe(true);

    // Get token addresses for testing
    // For EVM-to-EVM trading (should succeed)
    const baseUsdcAddress = config.specificChainTokens.base?.usdc;
    const ethUsdcAddress = config.specificChainTokens.eth?.usdc;

    // For EVM-to-SVM trading (should fail)
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;

    // Check the initial balances
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);

    const baseUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === baseUsdcAddress)
        ?.amount.toString() || "0",
    );

    // Ensure we have sufficient balance on Base for the test
    expect(baseUsdcBalance).toBeGreaterThan(0);

    const tradeAmount = Math.min(10, baseUsdcBalance * 0.1).toString();

    // PART 1: Test that EVM-to-EVM trading works with disallowXParent

    const evmToEvmResponse = await agentClient.executeTrade({
      fromToken: baseUsdcAddress,
      toToken: ethUsdcAddress,
      amount: tradeAmount,
      competitionId,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: SpecificChain.BASE,
      toSpecificChain: SpecificChain.ETH,
      reason: "testing EVM-to-EVM with disallowXParent",
    });

    // Expect the EVM-to-EVM trade to succeed with disallowXParent
    expect(evmToEvmResponse.success).toBe(true);

    // PART 2: Test that EVM-to-SVM trading fails with disallowXParent

    // Get updated balances after the first successful trade
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    const ethUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === ethUsdcAddress)
        ?.amount.toString() || "0",
    );

    expect(ethUsdcBalance).toBeGreaterThan(0);

    const secondTradeAmount = Math.min(5, ethUsdcBalance * 0.1).toString();

    const evmToSvmResponse = await agentClient.executeTrade({
      fromToken: ethUsdcAddress,
      toToken: svmUsdcAddress,
      amount: secondTradeAmount,
      competitionId,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.SVM,
      fromSpecificChain: SpecificChain.ETH,
      toSpecificChain: SpecificChain.SVM,
      reason: "testing EVM-to-SVM with disallowXParent",
    });

    // Expect the EVM-to-SVM trade to fail with disallowXParent
    expect(evmToSvmResponse.success).toBe(false);
    expect((evmToSvmResponse as ErrorResponse).error).toContain(
      "Cross-parent chain trading is disabled. Both tokens must be on the same parent blockchain",
    );
  });

  test("small numbers can be inserted into database", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Reason Required Agent",
    });

    // Start a competition with our agent
    const competitionName = `Reason Required Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });

    const smallValue = 2.938e-27;

    const trade: InsertTrade = {
      id: randomUUID(),
      timestamp: new Date(),
      fromToken: config.specificChainTokens.svm.usdc,
      toToken: config.specificChainTokens.svm.sol,
      fromAmount: smallValue,
      toAmount: smallValue,
      price: smallValue, // make sure exchange rate value can be very small
      toTokenSymbol: "NA",
      fromTokenSymbol: "USDC",
      success: true,
      agentId: agent.id,
      tradeAmountUsd: smallValue,
      competitionId: competition.competition.id,
      reason: "testing small numbers",
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.SVM,
      fromSpecificChain: SpecificChain.ETH,
      toSpecificChain: SpecificChain.SVM,
    };

    const [result] = await db
      .insert(tradesDef)
      .values({
        ...trade,
        timestamp: trade.timestamp || new Date(),
      })
      .returning();

    expect(result).toBeDefined();
    expect(result?.success).toBe(true);
    expect(result?.fromAmount).toBe(smallValue);
    expect(result?.toAmount).toBe(smallValue);
    expect(result?.price).toBe(smallValue);
  });

  test("trade amount USD is calculated and returned correctly", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "USD Amount Test Agent",
      });

    // Start a competition with our agent
    const competitionName = `USD Amount Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Get the current price of SOL to calculate expected USD value
    const priceResponse = await agentClient.getPrice(solTokenAddress);
    expect(priceResponse.success).toBe(true);
    const solPrice = (priceResponse as PriceResponse).price;
    expect(solPrice).toBeGreaterThan(0);

    // Get the current price of USDC to calculate actual USD value
    const usdcPriceResponse = await agentClient.getPrice(usdcTokenAddress);
    expect(usdcPriceResponse.success).toBe(true);
    const usdcPrice = (usdcPriceResponse as PriceResponse).price;
    expect(usdcPrice).toBeGreaterThan(0);

    // Define trade amount
    const tradeAmount = 100; // 100 USDC
    const expectedUsdValue = tradeAmount * usdcPrice!; // Calculate actual USD value based on USDC price

    // Execute a trade
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing tradeAmountUsd field",
    });

    // Verify the trade executed successfully
    expect(tradeResponse.success).toBe(true);

    // Verify tradeAmountUsd is included in the trade response and approximately correct
    expect(
      (tradeResponse as TradeResponse).transaction.tradeAmountUsd,
    ).toBeDefined();
    const actualUsdValue = (tradeResponse as TradeResponse).transaction
      .tradeAmountUsd;

    // Verify that the USD value is approximately correct (allow for small variations due to price movement)
    expect(actualUsdValue).toBeCloseTo(expectedUsdValue, 1); // Using precision 1 to allow for price movement between fetch and execution

    // Verify tradeAmountUsd also appears in trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);

    // Get the most recent trade (should be the one we just executed)
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];

    // Verify tradeAmountUsd is included in trade history and matches the trade response
    expect(lastTrade).toBeDefined();
    expect(lastTrade!.tradeAmountUsd).toBeDefined();
    expect(lastTrade!.tradeAmountUsd as number).toBeCloseTo(actualUsdValue!, 1);

    // Execute another trade with different token to verify tradeAmountUsd is calculated correctly
    const reverseTradeAmount = 10; // 10 SOL
    const reverseExpectedUsdValue = reverseTradeAmount * (solPrice ?? 0);

    const reverseTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: reverseTradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing reverse tradeAmountUsd calculation",
    });

    // Verify the reverse trade executed successfully
    expect(reverseTradeResponse.success).toBe(true);

    // Verify tradeAmountUsd is correctly calculated for the reverse trade
    const reverseActualUsdValue = (reverseTradeResponse as TradeResponse)
      .transaction.tradeAmountUsd;

    // Verify USD value is approximately correct, allowing for some variation due to price fluctuations
    expect(reverseActualUsdValue).toBeCloseTo(reverseExpectedUsdValue, 1);
  });

  test("symbol information is returned in all trading-related responses", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Symbol Verification Agent",
      });

    // Start a competition with our agent
    const competitionName = `Symbol Verification Test ${Date.now()}`;
    const competition = await startTestCompetition({
      adminClient,
      name: competitionName,
      agentIds: [agent.id],
    });
    const competitionId = competition.competition.id;

    // Get tokens to trade - use tokens we know have symbols
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // 1. Verify symbols are returned in initial balance response
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);

    const balancesResponse = initialBalanceResponse as BalancesResponse;
    const usdcBalance = balancesResponse.balances.find(
      (b) => b.tokenAddress === usdcTokenAddress,
    );
    const solBalance = balancesResponse.balances.find(
      (b) => b.tokenAddress === solTokenAddress,
    );

    // Verify symbol fields exist and are not empty
    expect(usdcBalance).toBeDefined();
    expect(usdcBalance!.symbol).toBeDefined();
    expect(typeof usdcBalance!.symbol).toBe("string");
    expect(usdcBalance!.symbol.length).toBeGreaterThan(0);

    expect(solBalance).toBeDefined();
    expect(solBalance!.symbol).toBeDefined();
    expect(typeof solBalance!.symbol).toBe("string");
    expect(solBalance!.symbol.length).toBeGreaterThan(0);

    // 2. Get a trade quote and verify symbols are included
    const quote = (await agentClient.getQuote(
      usdcTokenAddress,
      solTokenAddress,
      "100",
      competitionId,
    )) as QuoteResponse;

    // Check if it's an error response
    expect(quote).toBeDefined();
    expect("error" in quote).toBe(false); // Should not be an error response

    expect(quote.fromToken).toBe(usdcTokenAddress);
    expect(quote.toToken).toBe(solTokenAddress);
    expect(quote.symbols).toBeDefined();
    expect(quote.symbols.fromTokenSymbol).toBeDefined();
    expect(quote.symbols.toTokenSymbol).toBeDefined();
    expect(typeof quote.symbols.fromTokenSymbol).toBe("string");
    expect(typeof quote.symbols.toTokenSymbol).toBe("string");
    expect(quote.symbols.fromTokenSymbol.length).toBeGreaterThan(0);
    expect(quote.symbols.toTokenSymbol.length).toBeGreaterThan(0);

    // 3. Execute a trade and verify symbols in trade execution response
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "50",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing symbol fields in trade execution",
    });

    expect(tradeResponse.success).toBe(true);
    const transaction = (tradeResponse as TradeResponse).transaction;

    // Verify toTokenSymbol is included (we only store toTokenSymbol in the database)
    expect(transaction.toTokenSymbol).toBeDefined();
    expect(typeof transaction.toTokenSymbol).toBe("string");
    expect(transaction.toTokenSymbol.length).toBeGreaterThan(0);

    // Verify fromTokenSymbol is included
    expect(transaction.fromTokenSymbol).toBeDefined();
    expect(typeof transaction.fromTokenSymbol).toBe("string");
    expect(transaction.fromTokenSymbol.length).toBeGreaterThan(0);

    // 4. Verify symbols are returned in updated balance response
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    expect(updatedBalanceResponse.success).toBe(true);

    const updatedBalancesResponse = updatedBalanceResponse as BalancesResponse;
    const updatedUsdcBalance = updatedBalancesResponse.balances.find(
      (b) => b.tokenAddress === usdcTokenAddress,
    );
    const updatedSolBalance = updatedBalancesResponse.balances.find(
      (b) => b.tokenAddress === solTokenAddress,
    );

    // Verify symbols are still present and correct
    expect(updatedUsdcBalance).toBeDefined();
    expect(updatedUsdcBalance!.symbol).toBeDefined();
    expect(typeof updatedUsdcBalance!.symbol).toBe("string");
    expect(updatedUsdcBalance!.symbol.length).toBeGreaterThan(0);

    expect(updatedSolBalance).toBeDefined();
    expect(updatedSolBalance!.symbol).toBeDefined();
    expect(typeof updatedSolBalance!.symbol).toBe("string");
    expect(updatedSolBalance!.symbol.length).toBeGreaterThan(0);

    // 5. Verify symbols in trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);

    const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;
    expect(tradeHistory.trades.length).toBeGreaterThan(0);

    const lastTrade = tradeHistory.trades[0];
    expect(lastTrade).toBeDefined();

    expect(lastTrade!.toTokenSymbol).toBeDefined();
    expect(typeof lastTrade!.toTokenSymbol).toBe("string");
    expect(lastTrade!.toTokenSymbol.length).toBeGreaterThan(0);

    expect(lastTrade!.fromTokenSymbol).toBeDefined();
    expect(typeof lastTrade!.fromTokenSymbol).toBe("string");
    expect(lastTrade!.fromTokenSymbol.length).toBeGreaterThan(0);

    // 6. Verify symbols in balances response
    // Reuse existing balance data since no trades were executed since the last balance fetch
    const symbolBalances = (updatedBalanceResponse as BalancesResponse)
      .balances;
    expect(symbolBalances).toBeDefined();
    expect(symbolBalances.length).toBeGreaterThan(0);

    // Check each token in the balances has a symbol
    symbolBalances.forEach((balance) => {
      expect(balance.symbol).toBeDefined();
      expect(typeof balance.symbol).toBe("string");
      expect(balance.symbol.length).toBeGreaterThan(0);
    });

    // 7. Verify symbols match between trade execution and balances response
    expect(tradeResponse.success);
    const tradeTransaction = (tradeResponse as TradeResponse).transaction;
    const balances = (updatedBalanceResponse as BalancesResponse).balances;

    // Find SOL token in balances (the toToken from our trade)
    const solTokenInBalances = balances.find(
      (b) => b.tokenAddress === solTokenAddress,
    );

    // Find USDC token in balances (the fromToken from our trade)
    const usdcTokenInBalances = balances.find(
      (b) => b.tokenAddress === usdcTokenAddress,
    );

    expect(solTokenInBalances).toBeDefined();
    // Verify the toTokenSymbol from quote matches what's in the balances
    expect(quote.symbols.toTokenSymbol).toBe(solTokenInBalances!.symbol);

    // Verify the toTokenSymbol from trade execution matches what's in the balances
    expect(tradeTransaction.toTokenSymbol).toBe(solTokenInBalances!.symbol);

    expect(usdcTokenInBalances).toBeDefined();
    // Verify the fromTokenSymbol from quote matches what's in the balances
    expect(quote.symbols.fromTokenSymbol).toBe(usdcTokenInBalances!.symbol);

    // Verify the fromTokenSymbol from trade execution matches what's in the balances
    expect(tradeTransaction.fromTokenSymbol).toBe(usdcTokenInBalances!.symbol);
  });

  test("agent can execute a trade and verify balance updates", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register user and agent, get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Trading Agent",
      });

    // Start a competition with our agent
    const competitionName = `Trading Test ${Date.now()}`;
    const competitionResponse = (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    const competitionId = competitionResponse.competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect((initialBalanceResponse as BalancesResponse).success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // Verify token symbols are included
    expect(
      (buyTradeResponse as TradeResponse).transaction.fromTokenSymbol,
    ).toBeDefined();
    expect(
      (buyTradeResponse as TradeResponse).transaction.toTokenSymbol,
    ).toBeDefined();

    // Verify chain field is included in transaction response
    const buyTransaction = (buyTradeResponse as TradeResponse).transaction;
    expect(buyTransaction.fromChain).toBeDefined();
    expect(buyTransaction.fromChain).toBe(BlockchainType.SVM);
    expect(buyTransaction.toChain).toBeDefined();
    expect(buyTransaction.toChain).toBe(BlockchainType.SVM);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance(competitionId);
    expect(updatedBalanceResponse.success).toBe(true);

    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades,
    ).toBeInstanceOf(Array);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify chain fields in trades if they exist
    const lastTradeItem = (tradeHistoryResponse as TradeHistoryResponse)
      .trades[0];
    expect(lastTradeItem).toBeDefined();
    expect(lastTradeItem!.fromChain).toBeDefined();
    expect(lastTradeItem!.fromChain).toBe(BlockchainType.SVM);
    expect(lastTradeItem!.toChain).toBeDefined();
    expect(lastTradeItem!.toChain).toBe(BlockchainType.SVM);

    // Execute a sell trade (selling SOL for USDC)
    // Sell 50% of what we have to ensure we never try to sell more than we have
    const tokenToSell = updatedSolBalance * 0.5;

    const sellTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: tokenToSell.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(sellTradeResponse.success).toBe(true);
    expect((sellTradeResponse as TradeResponse).transaction).toBeDefined();

    // Check final balance
    const finalBalanceResponse = await agentClient.getBalance(competitionId);
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should have increased compared to after buying
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(finalUsdcBalance).toBeGreaterThan(updatedUsdcBalance);
    // SOL balance should have decreased compared to after buying
    const finalSolBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    expect(finalSolBalance).toBeLessThan(updatedSolBalance);
  });

  test("trading to dead address burns tokens (EVM and Solana)", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register agent and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Token Burn Test Agent",
      });

    // Start a competition with cross-chain trading enabled
    const competitionName = `Token Burn Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    });
    const competitionId = (competitionResponse as StartCompetitionResponse)
      .competition.id;

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance(competitionId);
    expect(initialBalanceResponse.success).toBe(true);

    // Get initial USDC balance on Solana
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );

    expect(initialUsdcBalance).toBeGreaterThan(0);

    const tradeAmount = 100; // Trade 100 USDC

    // Test 1: Burn tokens by trading to EVM dead address
    const evmDeadAddress = "0x000000000000000000000000000000000000dead";

    const evmBurnTradeResponse = await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: evmDeadAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "Burning tokens by trading to EVM dead address",
    });

    // Trade should succeed
    expect(evmBurnTradeResponse.success).toBe(true);

    const transaction = (evmBurnTradeResponse as TradeResponse).transaction;

    // Verify trade was recorded correctly
    expect(transaction.fromToken).toBe(svmUsdcAddress);
    expect(transaction.toToken).toBe(evmDeadAddress);
    expect(parseFloat(transaction.fromAmount.toString())).toBe(tradeAmount);

    // Key assertion: toAmount should be 0 (tokens burned)
    expect(parseFloat(transaction.toAmount.toString())).toBe(0);

    // Price should be 0 since we're burning
    expect(parseFloat(transaction.price.toString())).toBe(0);

    // Trade amount USD should reflect the value of tokens burned
    expect(transaction.tradeAmountUsd).toBeGreaterThan(0);

    // Check updated balance after EVM burn
    const afterEvmBurnBalanceResponse =
      await agentClient.getBalance(competitionId);
    const afterEvmBurnUsdcBalance = parseFloat(
      (afterEvmBurnBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );

    // USDC balance should have decreased (tokens burned)
    expect(afterEvmBurnUsdcBalance).toBe(initialUsdcBalance - tradeAmount);

    // Verify no balance was created for the dead address
    const evmDeadBalance = parseFloat(
      (afterEvmBurnBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === evmDeadAddress)
        ?.amount.toString() || "0",
    );
    expect(evmDeadBalance).toBe(0);

    // Test 2: Burn tokens by trading to Solana dead address
    const solanaDeadAddress = "1nc1nerator11111111111111111111111111111111";

    const solanaBurnTradeResponse = await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: solanaDeadAddress,
      amount: tradeAmount.toString(),
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Burning tokens by trading to Solana dead address",
    });

    // Trade should succeed
    expect(solanaBurnTradeResponse.success).toBe(true);

    const solanaBurnTransaction = (solanaBurnTradeResponse as TradeResponse)
      .transaction;

    // Verify trade was recorded correctly
    expect(solanaBurnTransaction.fromToken).toBe(svmUsdcAddress);
    expect(solanaBurnTransaction.toToken).toBe(solanaDeadAddress);
    expect(parseFloat(solanaBurnTransaction.fromAmount.toString())).toBe(
      tradeAmount,
    );

    // Key assertion: toAmount should be 0 (tokens burned)
    expect(parseFloat(solanaBurnTransaction.toAmount.toString())).toBe(0);

    // Price should be 0 since we're burning
    expect(parseFloat(solanaBurnTransaction.price.toString())).toBe(0);

    // Trade amount USD should reflect the value of tokens burned
    expect(solanaBurnTransaction.tradeAmountUsd).toBeGreaterThan(0);

    // Check final balance after both burns
    const finalBalanceResponse = await agentClient.getBalance(competitionId);
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );

    // USDC balance should have decreased by both burn amounts
    expect(finalUsdcBalance).toBe(initialUsdcBalance - tradeAmount * 2);

    // Verify no balance was created for the Solana dead address
    const solanaDeadBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solanaDeadAddress)
        ?.amount.toString() || "0",
    );
    expect(solanaDeadBalance).toBe(0);

    // Test 3: Verify burn trades appear correctly in trade history
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);

    const trades = (tradeHistoryResponse as TradeHistoryResponse).trades;

    // Find our burn trades (most recent should be first)
    const solanaBurnTrade = trades.find((t) => t.toToken === solanaDeadAddress);
    const evmBurnTrade = trades.find((t) => t.toToken === evmDeadAddress);

    expect(solanaBurnTrade).toBeDefined();
    expect(evmBurnTrade).toBeDefined();

    expect(parseFloat(solanaBurnTrade!.toAmount.toString())).toBe(0);
    expect(parseFloat(solanaBurnTrade!.price.toString())).toBe(0);
    expect(solanaBurnTrade!.reason).toBe(
      "Burning tokens by trading to Solana dead address",
    );

    expect(parseFloat(evmBurnTrade!.toAmount.toString())).toBe(0);
    expect(parseFloat(evmBurnTrade!.price.toString())).toBe(0);
    expect(evmBurnTrade!.reason).toBe(
      "Burning tokens by trading to EVM dead address",
    );
  });

  test("each competition uses its own cross-chain trading config independently", async () => {
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);
    const { client: agent1Client, agent: agent1 } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Agent Multi Comp",
      });

    // Create Competition 1 with cross-chain trading ENABLED
    const comp1Response = (await adminClient.startCompetition({
      name: `Cross-Chain Allow Comp ${Date.now()}`,
      agentIds: [agent1.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.ALLOW,
    })) as StartCompetitionResponse;
    const competition1 = comp1Response.competition;
    expect(comp1Response.success).toBe(true);

    // Verify cross-chain trade SUCCEEDS in competition 1 (ALLOW)
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    const tradeAmount = "10";
    const comp1TradeResponse = await agent1Client.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount,
      competitionId: competition1.id,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "Testing cross-chain enabled in comp1",
    });
    expect(comp1TradeResponse.success).toBe(true);

    // End competition 1, then create competition 2 with different settings
    await adminClient.endCompetition(competition1.id);

    // Create Competition 2 with cross-chain trading DISABLED
    const comp2Response = (await adminClient.startCompetition({
      name: `Cross-Chain Disallow Comp ${Date.now()}`,
      agentIds: [agent1.id],
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    })) as StartCompetitionResponse;
    const competition2 = comp2Response.competition;
    expect(comp2Response.success).toBe(true);

    // Verify cross-chain trade FAILS in competition 2 (DISALLOW_ALL)
    const comp2TradeResponse = await agent1Client.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount,
      competitionId: competition2.id,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "Testing cross-chain disabled in comp2",
    });
    expect(comp2TradeResponse.success).toBe(false);
    expect((comp2TradeResponse as ErrorResponse).error).toContain(
      "Cross-chain",
    );

    // This proves each competition uses its own crossChainTradingType config
    // from the database, not from global state. Testing simultaneous competitions
    // will require updating test utilities to accept competitionId parameter.
  });

  test("agent cannot execute trade on competition they are not registered for", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register two agents - one for the competition, one for testing
    const { client: agentClient } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Unregistered Agent",
    });

    // Register another agent that will be in the competition
    const { agent: competitionAgent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Competition Agent",
    });

    // Start a competition with only the second agent
    const competitionName = `Unregistered Agent Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [competitionAgent.id], // Only the second agent is registered
      tradingType: CROSS_CHAIN_TRADING_TYPE.DISALLOW_ALL,
    });
    const competitionId = (competitionResponse as StartCompetitionResponse)
      .competition.id;

    expect(competitionResponse.success).toBe(true);

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Attempt to execute a trade - this should fail because the agent is not registered
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "100",
      competitionId,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing trade with unregistered agent",
    });

    // Verify the trade failed
    expect(tradeResponse.success).toBe(false);
    expect((tradeResponse as ErrorResponse).error).toContain("not registered");

    // Verify that the agent can get balance but it should be empty since they're not in the competition
    const balanceResponse = await agentClient.getBalance(competitionId);
    expect(balanceResponse.success).toBe(true);
    expect((balanceResponse as BalancesResponse).balances).toBeDefined();
    expect((balanceResponse as BalancesResponse).balances.length).toBe(0);

    // Verify that the agent can get trade history but it should be empty since they're not in the competition
    const tradeHistoryResponse =
      await agentClient.getTradeHistory(competitionId);
    expect(tradeHistoryResponse.success).toBe(true);
    expect((tradeHistoryResponse as TradeHistoryResponse).trades).toBeDefined();
    expect((tradeHistoryResponse as TradeHistoryResponse).trades.length).toBe(
      0,
    );
  });
});
