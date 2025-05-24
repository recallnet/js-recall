import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import { db } from "@/database/db.js";
import { trades as tradesDef } from "@/database/schema/trading/defs.js";
import { InsertTrade } from "@/database/schema/trading/types.js";
import {
  BalancesResponse,
  BlockchainType,
  CrossChainTradingType,
  ErrorResponse,
  PortfolioResponse,
  PriceResponse,
  QuoteResponse,
  SpecificChain,
  StartCompetitionResponse,
  TokenBalance,
  TradeHistoryResponse,
  TradeResponse,
  TradeTransaction,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

const reason = "trading end-to-end test";

describe("Trading API", () => {
  const services = new ServiceRegistry();

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

  test("team can execute a trade and verify balance updates", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Trading Agent",
      });

    // Start a competition with our team
    const competitionName = `Trading Test ${Date.now()}`;
    (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.allow,
    })) as StartCompetitionResponse;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
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
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available
    console.log(
      `Trade amount: ${tradeAmount} (should be less than ${initialUsdcBalance})`,
    );

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // Verify chain field is included in transaction response
    if ((buyTradeResponse as TradeResponse).transaction.fromChain) {
      expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(
        BlockchainType.SVM,
      );
    }
    if ((buyTradeResponse as TradeResponse).transaction.toChain) {
      expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(
        BlockchainType.SVM,
      );
    }

    // Wait a bit longer for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);

    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Updated USDC balance: ${updatedUsdcBalance} (should be less than ${initialUsdcBalance})`,
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Updated SOL balance: ${updatedSolBalance} (should be greater than ${initialSolBalance})`,
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades,
    ).toBeInstanceOf(Array);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify chain fields in trades if they exist
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    if (lastTrade?.fromChain) {
      expect(lastTrade.fromChain).toBe(BlockchainType.SVM);
    }
    if (lastTrade?.toChain) {
      expect(lastTrade.toChain).toBe(BlockchainType.SVM);
    }

    // Execute a sell trade (selling SOL for USDC)
    // Sell 50% of what we have to ensure we never try to sell more than we have
    const tokenToSell = updatedSolBalance * 0.5;
    console.log(
      `Token to sell: ${tokenToSell} (should be less than ${updatedSolBalance})`,
    );

    const sellTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: tokenToSell.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Sell trade response: ${JSON.stringify(sellTradeResponse)}`);
    expect(sellTradeResponse.success).toBe(true);
    expect((sellTradeResponse as TradeResponse).transaction).toBeDefined();

    // Wait a bit longer for the trade to process
    await wait(500);

    // Check final balance
    const finalBalanceResponse = await agentClient.getBalance();
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should have increased compared to after buying
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Final USDC balance: ${finalUsdcBalance} (should be greater than ${updatedUsdcBalance})`,
    );
    expect(finalUsdcBalance).toBeGreaterThan(updatedUsdcBalance);
    // SOL balance should have decreased compared to after buying
    const finalSolBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Final SOL balance: ${finalSolBalance} (should be less than ${updatedSolBalance})`,
    );
    expect(finalSolBalance).toBeLessThan(updatedSolBalance);
  });

  test("team can execute a trade with an arbitrary token address", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Arbitrary Token Agent",
      });

    // Start a competition with our team
    const competitionName = `Arbitrary Token Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // The arbitrary token address to test with
    const arbitraryTokenAddress =
      "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === arbitraryTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Initial arbitrary token balance: ${initialArbitraryTokenBalance}`,
    );

    // Execute a direct trade using the API's expected parameters
    // We'll use the executeTrade method but we need to correctly map the parameters
    const tradeAmount = 10; // 10 USDC
    console.log(
      `Trading ${tradeAmount} USDC for arbitrary token ${arbitraryTokenAddress}`,
    );

    // Use the client's executeTrade which expects fromToken and toToken
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: arbitraryTokenAddress,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    if (buyTradeResponse.success) {
      const tradeResponse = buyTradeResponse as TradeResponse;
      expect(tradeResponse.transaction).toBeDefined();
      expect(tradeResponse.transaction.id).toBeDefined();
    }

    // Wait for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Updated USDC balance: ${updatedUsdcBalance}`);
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    expect(initialUsdcBalance - updatedUsdcBalance).toBeCloseTo(tradeAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased
    const updatedArbitraryTokenBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === arbitraryTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Updated arbitrary token balance: ${updatedArbitraryTokenBalance}`,
    );
    expect(updatedArbitraryTokenBalance).toBeGreaterThan(
      initialArbitraryTokenBalance,
    );

    // Get trade history
    const tradeHistoryResponse = await agentClient.getTradeHistory();
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
    expect(lastTrade?.toToken).toBe(arbitraryTokenAddress);
    expect((lastTrade as TradeTransaction)?.fromAmount).toBeCloseTo(
      tradeAmount,
      1,
    ); // Allow for small rounding differences
  });

  test("team cannot execute invalid trades", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Invalid Trading Agent",
      });

    // Start a competition with our team
    await startTestCompetition(
      adminClient,
      `Invalid Trading Test ${Date.now()}`,
      [agent.id],
    );

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
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
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(excessiveAmountResponse.success).toBe(false);
    expect((excessiveAmountResponse as ErrorResponse).error).toContain(
      "Cannot trade between identical tokens",
    );
    // Get portfolio value to calculate appropriate test amounts
    const portfolioResponse =
      (await agentClient.getPortfolio()) as PortfolioResponse;
    expect(portfolioResponse.success).toBe(true);
    const portfolioValue = portfolioResponse.totalValue;
    // Test insufficient balance with an amount below max trade percentage but above actual balance
    // Calculate 25% of portfolio value (below the 30% max trade limit) but ensure it exceeds the USDC balance
    const insufficientBalanceAmount = Math.max(
      initialUsdcBalance * 1.1,
      Math.min(portfolioValue * 0.25, initialUsdcBalance * 1.5),
    );

    // Check if this amount is actually greater than our balance but less than max trade percentage
    console.log(
      `Testing insufficient balance with amount: ${insufficientBalanceAmount}`,
    );
    console.log(
      `USDC Balance: ${initialUsdcBalance}, 25% of Portfolio: ${portfolioValue * 0.25}`,
    );
    // Add a test for truly excessive amounts after fixing the token address
    // The test should now execute a transaction where from != to
    const solanaPriceResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: insufficientBalanceAmount.toString(),
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

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Max Trade Limit Agent",
      });

    // Start a competition with our team
    await startTestCompetition(
      adminClient,
      `Max Trade Limit Test ${Date.now()}`,
      [agent.id],
    );

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse =
      (await agentClient.getBalance()) as BalancesResponse;

    const usdcTokenAddress = config.specificChainTokens.svm.usdc;

    // First, check if we have any SOL or other tokens and sell them to consolidate into USDC
    const tokenAddressesBefore = Object.keys(initialBalanceResponse.balances);
    console.log(
      `Team initial balances: ${JSON.stringify(initialBalanceResponse.balances)}`,
    );

    // Consolidate all non-USDC SVM tokens into USDC
    for (const tokenAddress of tokenAddressesBefore) {
      // Skip USDC itself
      if (tokenAddress === usdcTokenAddress) continue;

      // Only consolidate Solana (SVM) tokens - we want to avoid cross-chain trades
      const tokenChain = services.priceTracker.determineChain(tokenAddress);
      if (tokenChain !== BlockchainType.SVM) {
        console.log(
          `Skipping ${tokenAddress} - not a Solana token (${tokenChain})`,
        );
        continue;
      }

      const balance = parseFloat(
        initialBalanceResponse.balances
          .find((b) => b.tokenAddress === tokenAddress)
          ?.amount.toString() || "0",
      );

      // If we have a balance, sell it for USDC
      if (balance > 0) {
        console.log(
          `Converting ${balance} of ${tokenAddress} to USDC (SVM token)`,
        );
        const consolidateResponse = await agentClient.executeTrade({
          fromToken: tokenAddress,
          toToken: usdcTokenAddress,
          amount: balance.toString(),
          fromChain: BlockchainType.SVM,
          toChain: BlockchainType.SVM,
          reason,
        });

        console.log(
          `Consolidation result: ${consolidateResponse.success ? "success" : "failure"}`,
        );
        if (!consolidateResponse.success) {
          console.log(
            `Failed to consolidate ${tokenAddress}: ${(consolidateResponse as ErrorResponse).error}`,
          );
        }
      }
    }

    // Wait for trades to process
    await wait(500);

    // // Verify we now have a consolidated USDC balance
    const balanceAfterConsolidation = await agentClient.getBalance();
    console.log(
      JSON.stringify(balanceAfterConsolidation),
      "balanceAfterConsolidation",
    );
    const consolidatedUsdcBalance = parseFloat(
      (balanceAfterConsolidation as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Consolidated USDC balance: ${consolidatedUsdcBalance}`);
    expect(consolidatedUsdcBalance).toBeGreaterThan(0);

    // Get portfolio value to calculate trade percentage
    const portfolioResponse =
      (await agentClient.getPortfolio()) as PortfolioResponse;
    expect(portfolioResponse.success).toBe(true);
    const portfolioValue = portfolioResponse.totalValue;
    console.log(`Portfolio value: $${portfolioValue}`);

    // Try to trade almost all of our USDC balance for SOL
    // This should be over the MAX_TRADE_PERCENTAGE limit (5% in .env.test)
    const tradeAmount = consolidatedUsdcBalance * 0.95; // Use 95% of our USDC
    console.log(
      `Attempting to trade ${tradeAmount} USDC (95% of our consolidated balance)`,
    );

    // Calculate what percentage of portfolio this represents
    const tradePercentage = (tradeAmount / portfolioValue) * 100;
    console.log(`Trade amount: ${tradeAmount} USDC`);
    console.log(`Portfolio value: $${portfolioValue}`);
    console.log(
      `Trade percentage: ${tradePercentage}% (Max allowed: ${config.maxTradePercentage}%)`,
    );

    const maxPercentageResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(
      `Max percentage trade response: ${JSON.stringify(maxPercentageResponse)}`,
    );
    expect(maxPercentageResponse.success).toBe(false);
    expect((maxPercentageResponse as ErrorResponse).error).toContain(
      "exceeds maximum size",
    );
  });

  test("team can fetch price and execute a calculated trade", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Price Calculation Agent",
      });

    // Start a competition with our team
    const competitionName = `Price Calculation Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // The arbitrary token address specified
    const arbitraryTokenAddress =
      "Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs";
    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === arbitraryTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Initial ${arbitraryTokenAddress} token balance: ${initialArbitraryTokenBalance}`,
    );

    // 1. Fetch the price for the arbitrary token
    console.log(`Fetching price for token: ${arbitraryTokenAddress}`);
    const priceResponse = await agentClient.getPrice(arbitraryTokenAddress);
    expect(priceResponse.success).toBe(true);
    expect((priceResponse as PriceResponse).price).toBeDefined();

    const tokenPrice = (priceResponse as PriceResponse).price;
    console.log(`Token price: ${tokenPrice} USDC`);
    expect(tokenPrice).toBeGreaterThan(0);

    // 2. Calculate how much of the token can be bought with 10 USDC
    const usdcAmount = 10;
    const expectedTokenAmount = usdcAmount / (tokenPrice || 0); // Handle null case
    console.log(
      `With ${usdcAmount} USDC, expect to receive approximately ${expectedTokenAmount} tokens`,
    );

    // 3. Execute the trade (buy the token with 10 USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: arbitraryTokenAddress,
      amount: usdcAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // Wait for the trade to process
    await wait(500);

    // 4. Check final balance and validate it reflects the calculation
    const finalBalanceResponse = await agentClient.getBalance();
    expect(finalBalanceResponse.success).toBe(true);
    expect((finalBalanceResponse as BalancesResponse).balances).toBeDefined();
    // USDC balance should have decreased by 10
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Final USDC balance: ${finalUsdcBalance}`);
    expect(initialUsdcBalance - finalUsdcBalance).toBeCloseTo(usdcAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased by the calculated amount
    const finalTokenBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === arbitraryTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Final token balance: ${finalTokenBalance}`);
    expect(finalTokenBalance - initialArbitraryTokenBalance).toBeCloseTo(
      expectedTokenAmount,
      1,
    ); // Allow for small variations due to price fluctuations

    // Get trade history to verify details
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;
    expect(tradeHistory.trades).toBeInstanceOf(Array);
    expect(tradeHistory.trades.length).toBeGreaterThan(0);

    // Verify the trade details in history
    const lastTrade = tradeHistory.trades[0];
    expect(lastTrade?.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade?.toToken).toBe(arbitraryTokenAddress);
    expect(lastTrade?.fromAmount).toBeCloseTo(usdcAmount, 1);
    expect(lastTrade?.toAmount).toBeCloseTo(expectedTokenAmount, 1);
  });

  test("team can trade with Ethereum tokens", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Ethereum Token Agent",
      });

    // Start a competition with our team
    const competitionName = `Ethereum Token Test ${Date.now()}`;
    (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.allow,
    })) as StartCompetitionResponse;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    const balancesResponse = initialBalanceResponse as BalancesResponse;
    expect(balancesResponse.balances).toBeDefined();

    // Get Ethereum USDC token address from blockchain tokens config
    const ethUsdcTokenAddress = config.specificChainTokens.eth.usdc;
    if (!ethUsdcTokenAddress) {
      console.log("Skipping test: Ethereum USDC token address not configured");
      return;
    }

    // Get Ethereum ETH token address
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    if (!ethTokenAddress) {
      console.log("Skipping test: Ethereum ETH token address not configured");
      return;
    }

    // First check price to verify EVM tokens are working
    try {
      const priceResponse = await agentClient.getPrice(ethTokenAddress);

      // If we get a successful response, verify the token is recognized as EVM
      if ((priceResponse as PriceResponse).chain) {
        expect((priceResponse as PriceResponse).chain).toBe(BlockchainType.EVM);
        console.log(
          `Confirmed ETH token is on ${(priceResponse as PriceResponse).chain} chain with price ${(priceResponse as PriceResponse).price}`,
        );
      }
    } catch (error) {
      console.error(
        "Error getting ETH price, EVM tokens may not be supported:",
        error,
      );
      return; // Skip the rest of the test
    }

    // Check if we have any ETH balance already
    const initialEthBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === ethTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial ETH balance: ${initialEthBalance}`);

    // If we have SVM USDC, we can try to trade it for ETH
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const svmUsdcBalance = parseFloat(
      balancesResponse.balances
        .find((b) => b.tokenAddress === svmUsdcAddress)
        ?.amount.toString() || "0",
    );

    if (svmUsdcBalance > 0) {
      console.log(`Trading SVM USDC for ETH...`);
      // Use a small amount for the test
      const tradeAmount = Math.min(100, svmUsdcBalance * 0.1);

      // Execute a buy trade (buying ETH with USDC)
      const buyTradeResponse = (await agentClient.executeTrade({
        fromToken: svmUsdcAddress,
        toToken: ethTokenAddress,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.EVM,
        reason,
      })) as TradeResponse;

      console.log(
        `Buy ETH trade response: ${JSON.stringify(buyTradeResponse)}`,
      );
      expect(buyTradeResponse.success).toBe(true);

      // Wait for the trade to process
      await wait(500);

      // Check updated balance
      const updatedBalanceResponse = await agentClient.getBalance();
      // ETH balance should have increased
      const updatedEthBalance = parseFloat(
        (updatedBalanceResponse as BalancesResponse).balances
          .find((b) => b.tokenAddress === ethTokenAddress)
          ?.amount.toString() || "0",
      );
      console.log(`Updated ETH balance: ${updatedEthBalance}`);
      expect(updatedEthBalance).toBeGreaterThan(initialEthBalance);

      // Get trade history and verify the Ethereum trade
      const tradeHistoryResponse = await agentClient.getTradeHistory();
      expect(tradeHistoryResponse.success).toBe(true);
      expect(
        (tradeHistoryResponse as TradeHistoryResponse).trades.length,
      ).toBeGreaterThan(0);

      // Verify the last trade details
      const lastTrade = (tradeHistoryResponse as TradeHistoryResponse)
        .trades[0];
      expect(lastTrade?.toToken).toBe(ethTokenAddress);

      // Verify chain fields if they exist
      if (lastTrade?.toChain) {
        expect(lastTrade.toChain).toBe(BlockchainType.EVM);
        console.log(`Confirmed trade to chain is ${lastTrade.toChain}`);
      }
    } else {
      console.log(
        "No SVM USDC available for trading to ETH, skipping trade execution",
      );
    }
  });

  test("team can execute trades with explicit chain parameters", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Chain-Specific Trading Agent",
      });

    // Start a competition with our team
    const competitionName = `Chain-Specific Trading Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // The amount to trade
    const tradeAmount = 50;

    // Execute a buy trade with explicit Solana chain parameters
    console.log("Executing trade with explicit Solana chain parameters");
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();

    // Verify chain fields in the transaction
    expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(
      BlockchainType.SVM,
    );
    expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(
      BlockchainType.SVM,
    );

    // Wait for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Updated USDC balance: ${updatedUsdcBalance}`);
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Updated SOL balance: ${updatedSolBalance}`);
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history and verify chain info is preserved
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    // Get the most recent trade
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];

    // Verify chain fields in the trade history
    expect(lastTrade?.fromChain).toBe(BlockchainType.SVM);
    expect(lastTrade?.toChain).toBe(BlockchainType.SVM);

    // Test cross-chain trading validation when disabled
    // First, we need to check if cross-chain trading is disabled
    try {
      // Get Ethereum ETH token address
      const ethTokenAddress = config.specificChainTokens.eth.eth;
      if (!ethTokenAddress) {
        console.log(
          "Skipping cross-chain test: Ethereum ETH token address not configured",
        );
        return;
      }

      // Attempt to execute a cross-chain trade with explicit chain parameters
      // This should succeed if cross-chain trading is enabled, or fail if disabled
      console.log("Attempting cross-chain trade (Solana USDC to Ethereum ETH)");
      const crossChainTradeResponse = await agentClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: ethTokenAddress,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.SVM,
        toSpecificChain: SpecificChain.ETH,
        reason,
      });

      console.log(
        `Cross-chain trade response: ${JSON.stringify(crossChainTradeResponse)}`,
      );

      expect(crossChainTradeResponse.success).toBe(false);
      expect((crossChainTradeResponse as ErrorResponse).error).toContain(
        "Cross-chain trading is disabled",
      );
    } catch (error) {
      console.error("Error testing cross-chain trading:", error);
    }
  });

  test("team can execute a trade and verify reason field is returned in responses", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Reason Verification Agent",
      });

    // Start a competition with our team
    const competitionName = `Reason Verification Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

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
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: specificReason,
    })) as TradeResponse;

    // Verify trade executed successfully
    expect(tradeResponse.success).toBe(true);
    expect(tradeResponse.transaction).toBeDefined();

    // Verify reason is included in the trade execution response
    expect(tradeResponse.transaction.reason).toBe(specificReason);
    console.log(
      `Verified reason in trade execution response: "${tradeResponse.transaction.reason}"`,
    );

    // Wait for trade to be processed
    await wait(500);

    // Get trade history
    const tradeHistoryResponse =
      (await agentClient.getTradeHistory()) as TradeHistoryResponse;

    // Verify trade history response
    expect(tradeHistoryResponse.success).toBe(true);
    expect(tradeHistoryResponse.trades).toBeInstanceOf(Array);
    expect(tradeHistoryResponse.trades.length).toBeGreaterThan(0);

    // Get the most recent trade (should be the one we just executed)
    const lastTrade = tradeHistoryResponse.trades[0];

    // Verify reason is included in trade history
    expect(lastTrade?.reason).toBe(specificReason);
    console.log(
      `Verified reason in trade history response: "${lastTrade?.reason}"`,
    );

    // Further verify other trade details match
    expect(lastTrade?.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade?.toToken).toBe(solTokenAddress);
    expect(parseFloat(lastTrade?.fromAmount.toString() || "0")).toBeCloseTo(
      10,
      1,
    );
  });

  test("team cannot execute a trade without a reason field", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Reason Required Agent",
      });

    // Start a competition with our team
    const competitionName = `Reason Required Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Attempt to execute a trade without providing a reason field
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "10",
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

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Cross-Chain Settings Agent",
      });

    // Get token addresses for testing
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const ethTokenAddress = config.specificChainTokens.eth.eth;

    if (!ethTokenAddress) {
      console.log("Skipping test: Ethereum ETH token address not configured");
      return;
    }

    // Start a competition with cross-chain trading DISABLED
    const competitionName = `Cross-Chain Settings Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.disallowAll,
    });

    expect(competitionResponse.success).toBe(true);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check if competition rules reflect the disabled cross-chain trading
    const rulesResponse = await agentClient.getRules();
    expect(rulesResponse.success).toBe(true);

    // Find cross-chain trading rule in the rules list
    if (rulesResponse.success && rulesResponse.rules) {
      const crossChainRule = rulesResponse.rules.tradingRules.find(
        (rule: string) => rule.includes("Cross-chain trading"),
      );
      expect(crossChainRule).toBeDefined();
      expect(crossChainRule).toContain("disallowAll");
    }

    // Verify that cross-chain trading is actually disabled by attempting a cross-chain trade
    console.log(
      "Attempting cross-chain trade when it's disabled in competition settings",
    );

    const balanceResponse = await agentClient.getBalance();
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
    await wait(500);

    // Start a new competition with cross-chain trading ENABLED
    const secondCompetitionName = `Cross-Chain Enabled Test ${Date.now()}`;
    const secondCompetitionResponse = await adminClient.startCompetition({
      name: secondCompetitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.allow,
    });

    expect(secondCompetitionResponse.success).toBe(true);
    await wait(500);

    // Check if competition rules reflect the enabled cross-chain trading
    const secondRulesResponse = await agentClient.getRules();
    expect(secondRulesResponse.success).toBe(true);

    // Find cross-chain trading rule in the rules list
    if (secondRulesResponse.success && secondRulesResponse.rules) {
      const crossChainRule = secondRulesResponse.rules.tradingRules.find(
        (rule: string) => rule.includes("Cross-chain trading"),
      );
      expect(crossChainRule).toBeDefined();
      expect(crossChainRule).toContain("Cross-chain trading type: allow");
    }

    // Now try to execute a cross-chain trade (should succeed)
    console.log(
      "Attempting cross-chain trade when it's enabled in competition settings",
    );

    const secondTradeResponse = await agentClient.executeTrade({
      fromToken: svmUsdcAddress,
      toToken: ethTokenAddress,
      amount: tradeAmount,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.EVM,
      reason: "testing cross-chain trading enabled",
    });

    // Expect the trade to succeed now that cross-chain trading is enabled
    expect(secondTradeResponse.success).toBe(true);
    if (!secondTradeResponse.success) {
      console.error(
        "Cross-chain trade failed with error:",
        (secondTradeResponse as ErrorResponse).error,
      );
      console.error("Competition settings were:", secondCompetitionResponse);
    }
  });

  test("EVM-to-EVM trades are recognized as cross-chain", async () => {
    // Check if we have at least two EVM chains configured
    const evmChains = Object.keys(config.specificChainTokens).filter(
      (chain) => chain !== "svm" && chain !== "evm",
    );

    if (evmChains.length < 2) {
      console.log(
        "Skipping EVM-to-EVM cross-chain test: Need at least 2 EVM chains configured",
      );
      return;
    }

    // Select two different EVM chains for testing
    const sourceChain = config.evmChains[0] as SpecificChain;
    const targetChain = evmChains[1] as SpecificChain;

    console.log(
      `Testing EVM-to-EVM cross-chain trading from ${sourceChain} to ${targetChain}`,
    );

    // Get USDC addresses for both chains
    const sourceUsdcAddress =
      config.specificChainTokens[
        sourceChain as keyof typeof config.specificChainTokens
      ]?.usdc;
    const targetUsdcAddress =
      config.specificChainTokens[
        targetChain as keyof typeof config.specificChainTokens
      ]?.usdc;

    if (!sourceUsdcAddress || !targetUsdcAddress) {
      console.log(
        `Skipping EVM-to-EVM test: USDC not configured for ${sourceChain} or ${targetChain}`,
      );
      return;
    }

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
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
      tradingType: CrossChainTradingType.disallowAll,
    });

    expect(competitionResponse.success).toBe(true);
    await wait(500);

    // Verify the team has some balance on the source chain
    const initialBalanceResponse = await agentClient.getBalance();
    const sourceUsdcBalance = parseFloat(
      (initialBalanceResponse.success &&
        (initialBalanceResponse as BalancesResponse).balances
          .find((b) => b.tokenAddress === sourceUsdcAddress)
          ?.amount.toString()) ||
        "0",
    );

    // If we don't have any balance, we'll need to skip this test
    if (!sourceUsdcBalance || sourceUsdcBalance <= 0) {
      console.log(
        `No balance available for ${sourceChain} USDC, skipping test`,
      );
      return;
    }

    const tradeAmount = Math.min(10, sourceUsdcBalance * 0.1).toString();
    console.log(
      `Trading ${tradeAmount} USDC from ${sourceChain} to ${targetChain}`,
    );

    // Attempt to execute an EVM-to-EVM cross-chain trade when disabled
    const crossChainTradeResponse = await agentClient.executeTrade({
      fromToken: sourceUsdcAddress,
      toToken: targetUsdcAddress,
      amount: tradeAmount,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: sourceChain,
      toSpecificChain: targetChain,
      reason: "testing EVM-to-EVM cross-chain trading disabled",
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
    await wait(500);

    // Start a new competition with cross-chain trading ENABLED
    const secondCompetitionName = `EVM-EVM Cross-Chain Enabled Test ${Date.now()}`;
    const secondCompetitionResponse = await adminClient.startCompetition({
      name: secondCompetitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.allow,
    });

    expect(secondCompetitionResponse.success).toBe(true);
    await wait(500);

    // Now try to execute the same EVM-to-EVM cross-chain trade (should succeed)
    const secondTradeResponse = await agentClient.executeTrade({
      fromToken: sourceUsdcAddress,
      toToken: targetUsdcAddress,
      amount: tradeAmount,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: sourceChain,
      toSpecificChain: targetChain,
      reason: "testing EVM-to-EVM cross-chain trading enabled",
    });

    // Expect the trade to succeed now that cross-chain trading is enabled
    expect(secondTradeResponse.success).toBe(true);
    if (!secondTradeResponse.success) {
      console.error(
        "EVM-to-EVM cross-chain trade failed with error:",
        (secondTradeResponse as ErrorResponse).error,
      );
      console.error("Competition settings were:", secondCompetitionResponse);
      console.error("Trade parameters:", {
        fromToken: sourceUsdcAddress,
        toToken: targetUsdcAddress,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: sourceChain,
        toSpecificChain: targetChain,
      });
    }
  });

  test("CrossChainTradingType.disallowXParent allows same-parent-chain trading but blocks cross-parent-chain trading", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
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
      tradingType: CrossChainTradingType.disallowXParent,
    });

    expect(competitionResponse.success).toBe(true);
    await wait(500);

    // Get token addresses for testing
    // For EVM-to-EVM trading (should succeed)
    const baseUsdcAddress = config.specificChainTokens.base?.usdc;
    const ethUsdcAddress = config.specificChainTokens.eth?.usdc;

    // For EVM-to-SVM trading (should fail)
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;

    // Check the initial balances
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    const baseUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === baseUsdcAddress)
        ?.amount.toString() || "0",
    );

    // If we don't have any balance on Base, we need to skip this test
    if (baseUsdcBalance <= 0) {
      console.log("No balance available for Base USDC, skipping test");
      return;
    }

    const tradeAmount = Math.min(10, baseUsdcBalance * 0.1).toString();

    // PART 1: Test that EVM-to-EVM trading works with disallowXParent
    console.log(
      `Testing EVM-to-EVM trading (Base -> ETH) with disallowXParent setting`,
    );

    const evmToEvmResponse = await agentClient.executeTrade({
      fromToken: baseUsdcAddress,
      toToken: ethUsdcAddress,
      amount: tradeAmount,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: SpecificChain.BASE,
      toSpecificChain: SpecificChain.ETH,
      reason: "testing EVM-to-EVM with disallowXParent",
    });

    // Expect the EVM-to-EVM trade to succeed with disallowXParent
    expect(evmToEvmResponse.success).toBe(true);
    if (!evmToEvmResponse.success) {
      console.error(
        "EVM-to-EVM trade failed unexpectedly with disallowXParent setting:",
        (evmToEvmResponse as ErrorResponse).error,
      );
    } else {
      console.log(
        "EVM-to-EVM trade succeeded as expected with disallowXParent setting",
      );
    }

    // Wait for the trade to process
    await wait(500);

    // PART 2: Test that EVM-to-SVM trading fails with disallowXParent
    console.log(
      `Testing EVM-to-SVM trading (ETH -> Solana) with disallowXParent setting`,
    );

    // Get updated balances after the first successful trade
    const updatedBalanceResponse = await agentClient.getBalance();
    const ethUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === ethUsdcAddress)
        ?.amount.toString() || "0",
    );

    if (ethUsdcBalance <= 0) {
      console.log(
        "No ETH USDC balance available for testing EVM-to-SVM, skipping second part",
      );
      return;
    }

    const secondTradeAmount = Math.min(5, ethUsdcBalance * 0.1).toString();

    const evmToSvmResponse = await agentClient.executeTrade({
      fromToken: ethUsdcAddress,
      toToken: svmUsdcAddress,
      amount: secondTradeAmount,
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

    console.log(
      "EVM-to-SVM trade failed as expected with disallowXParent setting",
    );
  });

  test("small numbers can be inserted into database", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { agent } = await registerUserAndAgentAndGetClient({
      adminApiKey,
      agentName: "Reason Required Agent",
    });

    // Start a competition with our team
    const competitionName = `Reason Required Test ${Date.now()}`;
    const competition = await startTestCompetition(
      adminClient,
      competitionName,
      [agent.id],
    );

    // Wait for balances to be properly initialized
    await wait(500);

    const smallValue = 2.938e-27;

    const trade: InsertTrade = {
      id: uuidv4(),
      timestamp: new Date(),
      fromToken: config.specificChainTokens.svm.usdc,
      toToken: config.specificChainTokens.svm.sol,
      fromAmount: smallValue,
      toAmount: smallValue,
      price: smallValue, // make sure exchange rate value can be very small
      toTokenSymbol: "NA",
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

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "USD Amount Test Agent",
      });

    // Start a competition with our team
    const competitionName = `USD Amount Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Get the current price of SOL to calculate expected USD value
    const priceResponse = await agentClient.getPrice(solTokenAddress);
    expect(priceResponse.success).toBe(true);
    const solPrice = (priceResponse as PriceResponse).price;
    expect(solPrice).toBeGreaterThan(0);
    console.log(`Current SOL price: $${solPrice}`);

    // Define trade amount
    const tradeAmount = 100; // 100 USDC
    const expectedUsdValue = tradeAmount; // Since we're trading from USDC, the USD value should be ~tradeAmount

    // Execute a trade
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
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
    console.log(`Trade amount USD: $${actualUsdValue}`);

    // Verify that the USD value is approximately correct (allow for small variations)
    expect(actualUsdValue).toBeCloseTo(expectedUsdValue, 0); // Using precision 0 to allow for some variation

    // Wait for trade to be processed
    await wait(500);

    // Verify tradeAmountUsd also appears in trade history
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);

    // Get the most recent trade (should be the one we just executed)
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];

    // Verify tradeAmountUsd is included in trade history and matches the trade response
    expect(lastTrade).toBeDefined();
    if (lastTrade) {
      expect(lastTrade.tradeAmountUsd).toBeDefined();
      expect(lastTrade.tradeAmountUsd as number).toBeCloseTo(
        actualUsdValue!,
        1,
      );
    }

    // Execute another trade with different token to verify tradeAmountUsd is calculated correctly
    const reverseTradeAmount = 10; // 10 SOL
    const reverseExpectedUsdValue = reverseTradeAmount * (solPrice ?? 0);

    const reverseTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: reverseTradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing reverse tradeAmountUsd calculation",
    });

    // Verify the reverse trade executed successfully
    expect(reverseTradeResponse.success).toBe(true);

    // Verify tradeAmountUsd is correctly calculated for the reverse trade
    const reverseActualUsdValue = (reverseTradeResponse as TradeResponse)
      .transaction.tradeAmountUsd;
    console.log(
      `Reverse trade amount USD: $${reverseActualUsdValue} (expected ~$${reverseExpectedUsdValue})`,
    );

    // Verify USD value is approximately correct, allowing for some variation due to price fluctuations
    expect(reverseActualUsdValue).toBeCloseTo(reverseExpectedUsdValue, 0);
  });

  test("symbol information is returned in all trading-related responses", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: agentClient, agent } =
      await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Symbol Verification Agent",
      });

    // Start a competition with our team
    const competitionName = `Symbol Verification Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [agent.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Get tokens to trade - use tokens we know have symbols
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // 1. Verify symbols are returned in initial balance response
    console.log("1. Checking symbols in initial balance response...");
    const initialBalanceResponse = await agentClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    const balancesResponse = initialBalanceResponse as BalancesResponse;
    const usdcBalance = balancesResponse.balances.find(
      (b) => b.tokenAddress === usdcTokenAddress,
    );
    const solBalance = balancesResponse.balances.find(
      (b) => b.tokenAddress === solTokenAddress,
    );

    // Verify symbol fields exist and are not empty
    if (usdcBalance) {
      expect(usdcBalance.symbol).toBeDefined();
      expect(typeof usdcBalance.symbol).toBe("string");
      expect(usdcBalance.symbol.length).toBeGreaterThan(0);
      console.log(`USDC symbol in balance: "${usdcBalance.symbol}"`);
    }

    if (solBalance) {
      expect(solBalance.symbol).toBeDefined();
      expect(typeof solBalance.symbol).toBe("string");
      expect(solBalance.symbol.length).toBeGreaterThan(0);
      console.log(`SOL symbol in balance: "${solBalance.symbol}"`);
    }

    // 2. Get a trade quote and verify symbols are included
    console.log("2. Checking symbols in trade quote response...");
    const quoteResponse = await agentClient.getQuote(
      usdcTokenAddress,
      solTokenAddress,
      "100",
    );

    // Check if it's an error response
    expect(quoteResponse).toBeDefined();
    expect("error" in quoteResponse).toBe(false); // Should not be an error response

    // Cast to QuoteResponse since we've verified it's not an error
    const quote = quoteResponse as QuoteResponse;
    expect(quote.fromToken).toBe(usdcTokenAddress);
    expect(quote.toToken).toBe(solTokenAddress);
    expect(quote.symbols).toBeDefined();
    expect(quote.symbols.fromTokenSymbol).toBeDefined();
    expect(quote.symbols.toTokenSymbol).toBeDefined();
    expect(typeof quote.symbols.fromTokenSymbol).toBe("string");
    expect(typeof quote.symbols.toTokenSymbol).toBe("string");
    expect(quote.symbols.fromTokenSymbol.length).toBeGreaterThan(0);
    expect(quote.symbols.toTokenSymbol.length).toBeGreaterThan(0);

    console.log(`Quote fromTokenSymbol: "${quote.symbols.fromTokenSymbol}"`);
    console.log(`Quote toTokenSymbol: "${quote.symbols.toTokenSymbol}"`);

    // 3. Execute a trade and verify symbols in trade execution response
    console.log("3. Executing trade and checking symbols in response...");
    const tradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: "50",
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "Testing symbol fields in trade execution",
    });

    expect(tradeResponse.success).toBe(true);
    if (tradeResponse.success) {
      const transaction = (tradeResponse as TradeResponse).transaction;

      // Verify toTokenSymbol is included (we only store toTokenSymbol in the database)
      expect(transaction.toTokenSymbol).toBeDefined();
      expect(typeof transaction.toTokenSymbol).toBe("string");
      expect(transaction.toTokenSymbol.length).toBeGreaterThan(0);
      console.log(
        `Trade execution toTokenSymbol: "${transaction.toTokenSymbol}"`,
      );
    }

    // Wait for trade to be processed
    await wait(500);

    // 4. Verify symbols are returned in updated balance response
    console.log("4. Checking symbols in updated balance response...");
    const updatedBalanceResponse = await agentClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);

    const updatedBalancesResponse = updatedBalanceResponse as BalancesResponse;
    const updatedUsdcBalance = updatedBalancesResponse.balances.find(
      (b) => b.tokenAddress === usdcTokenAddress,
    );
    const updatedSolBalance = updatedBalancesResponse.balances.find(
      (b) => b.tokenAddress === solTokenAddress,
    );

    // Verify symbols are still present and correct
    if (updatedUsdcBalance) {
      expect(updatedUsdcBalance.symbol).toBeDefined();
      expect(typeof updatedUsdcBalance.symbol).toBe("string");
      expect(updatedUsdcBalance.symbol.length).toBeGreaterThan(0);
      console.log(`Updated USDC symbol: "${updatedUsdcBalance.symbol}"`);
    }

    if (updatedSolBalance) {
      expect(updatedSolBalance.symbol).toBeDefined();
      expect(typeof updatedSolBalance.symbol).toBe("string");
      expect(updatedSolBalance.symbol.length).toBeGreaterThan(0);
      console.log(`Updated SOL symbol: "${updatedSolBalance.symbol}"`);
    }

    // 5. Verify symbols in trade history
    console.log("5. Checking symbols in trade history response...");
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);

    if (tradeHistoryResponse.success) {
      const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;
      expect(tradeHistory.trades.length).toBeGreaterThan(0);

      const lastTrade = tradeHistory.trades[0];
      expect(lastTrade).toBeDefined();

      if (lastTrade) {
        expect(lastTrade.toTokenSymbol).toBeDefined();
        expect(typeof lastTrade.toTokenSymbol).toBe("string");
        expect(lastTrade.toTokenSymbol.length).toBeGreaterThan(0);
        console.log(
          `Trade history toTokenSymbol: "${lastTrade.toTokenSymbol}"`,
        );
      }
    }

    // 6. Verify symbols in portfolio response
    console.log("6. Checking symbols in portfolio response...");
    const portfolioResponse = await agentClient.getPortfolio();
    expect(portfolioResponse.success).toBe(true);

    if (portfolioResponse.success) {
      const portfolio = portfolioResponse as PortfolioResponse;
      expect(portfolio.tokens).toBeDefined();
      expect(portfolio.tokens.length).toBeGreaterThan(0);

      // Check each token in the portfolio has a symbol
      portfolio.tokens.forEach((token, index) => {
        expect(token.symbol).toBeDefined();
        expect(typeof token.symbol).toBe("string");
        expect(token.symbol.length).toBeGreaterThan(0);
        console.log(
          `Portfolio token ${index} symbol: "${token.symbol}" for address ${token.token}`,
        );
      });
    }

    // 7. Verify symbols match between responses
    console.log("7. Verifying symbol consistency across responses...");
    if (
      !("error" in quoteResponse) &&
      tradeResponse.success &&
      portfolioResponse.success
    ) {
      const quote = quoteResponse as QuoteResponse;
      const tradeTransaction = (tradeResponse as TradeResponse).transaction;
      const portfolio = portfolioResponse as PortfolioResponse;

      // Find SOL token in portfolio (the toToken from our trade)
      const solTokenInPortfolio = portfolio.tokens.find(
        (t) => t.token === solTokenAddress,
      );

      if (solTokenInPortfolio) {
        // Verify the toTokenSymbol from quote matches what's in the portfolio
        expect(quote.symbols.toTokenSymbol).toBe(solTokenInPortfolio.symbol);

        // Verify the toTokenSymbol from trade execution matches what's in the portfolio
        expect(tradeTransaction.toTokenSymbol).toBe(solTokenInPortfolio.symbol);

        console.log(
          `Symbol consistency verified: "${quote.symbols.toTokenSymbol}" across all responses`,
        );
      }
    }

    console.log("✅ All symbol verification tests passed!");
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
    (await adminClient.startCompetition({
      name: competitionName,
      agentIds: [agent.id],
      tradingType: CrossChainTradingType.allow,
    })) as StartCompetitionResponse;

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await agentClient.getBalance();
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
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available
    console.log(
      `Trade amount: ${tradeAmount} (should be less than ${initialUsdcBalance})`,
    );

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await agentClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Buy trade response: ${JSON.stringify(buyTradeResponse)}`);
    expect(buyTradeResponse.success).toBe(true);
    expect((buyTradeResponse as TradeResponse).transaction).toBeDefined();
    expect((buyTradeResponse as TradeResponse).transaction.id).toBeDefined();

    // Verify chain field is included in transaction response
    if ((buyTradeResponse as TradeResponse).transaction.fromChain) {
      expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(
        BlockchainType.SVM,
      );
    }
    if ((buyTradeResponse as TradeResponse).transaction.toChain) {
      expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(
        BlockchainType.SVM,
      );
    }

    // Wait a bit longer for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await agentClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);

    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Updated USDC balance: ${updatedUsdcBalance} (should be less than ${initialUsdcBalance})`,
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Updated SOL balance: ${updatedSolBalance} (should be greater than ${initialSolBalance})`,
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history
    const tradeHistoryResponse = await agentClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades,
    ).toBeInstanceOf(Array);
    expect(
      (tradeHistoryResponse as TradeHistoryResponse).trades.length,
    ).toBeGreaterThan(0);

    // Verify chain fields in trades if they exist
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    if (lastTrade?.fromChain) {
      expect(lastTrade.fromChain).toBe(BlockchainType.SVM);
    }
    if (lastTrade?.toChain) {
      expect(lastTrade.toChain).toBe(BlockchainType.SVM);
    }

    // Execute a sell trade (selling SOL for USDC)
    // Sell 50% of what we have to ensure we never try to sell more than we have
    const tokenToSell = updatedSolBalance * 0.5;
    console.log(
      `Token to sell: ${tokenToSell} (should be less than ${updatedSolBalance})`,
    );

    const sellTradeResponse = await agentClient.executeTrade({
      fromToken: solTokenAddress,
      toToken: usdcTokenAddress,
      amount: tokenToSell.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Sell trade response: ${JSON.stringify(sellTradeResponse)}`);
    expect(sellTradeResponse.success).toBe(true);
    expect((sellTradeResponse as TradeResponse).transaction).toBeDefined();

    // Wait a bit longer for the trade to process
    await wait(500);

    // Check final balance
    const finalBalanceResponse = await agentClient.getBalance();
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should have increased compared to after buying
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Final USDC balance: ${finalUsdcBalance} (should be greater than ${updatedUsdcBalance})`,
    );
    expect(finalUsdcBalance).toBeGreaterThan(updatedUsdcBalance);
    // SOL balance should have decreased compared to after buying
    const finalSolBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === solTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(
      `Final SOL balance: ${finalSolBalance} (should be less than ${updatedSolBalance})`,
    );
    expect(finalSolBalance).toBeLessThan(updatedSolBalance);
  });
});
