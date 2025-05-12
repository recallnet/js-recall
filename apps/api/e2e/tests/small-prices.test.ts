import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  BalancesResponse,
  BlockchainType,
  ErrorResponse,
  PriceResponse,
  SpecificChain,
  TradeHistoryResponse,
  TradeResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
  registerTeamAndGetClient,
  wait,
} from "@/e2e/utils/test-helpers.js";

describe("Small Prices Test", () => {
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

  test("team can execute a trade buying a token with a very small price", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      "Cross-Chain Detailed Reasoning Team",
    );

    // Start a competition with cross-chain trading ENABLED
    const competitionName = `Small prices Test ${Date.now()}`;
    const competitionResponse = await adminClient.startCompetition({
      name: competitionName,
      teamIds: [team.id],
    });

    expect(competitionResponse.success).toBe(true);
    await wait(500);

    // Define the trade parameters from the provided data
    const fromToken = config.specificChainTokens.svm.usdc; // USDC on Solana
    const toToken = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"; // BONK on Solana
    const tradeAmount = "5000";
    const detailedReason = "Attempt to buy BONK with USDC";

    // first get the current price of the token
    const priceResponse = (await teamClient.getPrice(toToken)) as PriceResponse;
    //log the price
    console.log(`Price of BONK: ${priceResponse.price?.toString()}`);

    // calculate the expected amount of BONK we should get
    const expectedTokenAmount = parseFloat(tradeAmount) / priceResponse.price!;
    console.log(`Expected amount of BONK: ${expectedTokenAmount}`);

    // First, check if we have a balance on the source chain
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    // get the current balance of the fromToken
    const fromTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === fromToken)
        ?.amount.toString() || "0",
    );
    console.log(`From token balance before trade: ${fromTokenBalance}`);

    // Execute the trade
    console.log(`Executing trade from ${fromToken} to ${toToken}`);
    const tradeResponse = await teamClient.executeTrade({
      fromToken: fromToken,
      toToken: toToken,
      amount: tradeAmount,
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      fromSpecificChain: SpecificChain.SVM,
      toSpecificChain: SpecificChain.SVM,
      reason: detailedReason,
    });

    console.log(`Trade response: ${JSON.stringify(tradeResponse)}`);
    await wait(500);

    const testBalanceResponse = await teamClient.getBalance();
    const toTokenBalanceAfter = parseFloat(
      (testBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === toToken)
        ?.amount.toString() || "0",
    );
    console.log(`To token balance after trade: ${toTokenBalanceAfter}`);

    // Expect the trade to succeed
    expect(tradeResponse.success).toBe(true);
    if (!tradeResponse.success) {
      console.error(
        "Cross-chain trade failed with error:",
        (tradeResponse as ErrorResponse).error,
      );
    } else {
      // Verify transaction details
      const transaction = (tradeResponse as TradeResponse).transaction;
      expect(transaction).toBeDefined();
      expect(transaction.fromToken).toBe(fromToken);
      expect(transaction.toToken).toBe(toToken);
      expect(transaction.fromChain).toBe(BlockchainType.SVM);
      expect(transaction.toChain).toBe(BlockchainType.SVM);
      expect(transaction.fromSpecificChain).toBe(SpecificChain.SVM);
      expect(transaction.toSpecificChain).toBe(SpecificChain.SVM);
      expect(transaction.reason).toBe(detailedReason);
      // expect the resulting amount to be close to the expected amount
      const percentDifference =
        Math.abs(
          (toTokenBalanceAfter - expectedTokenAmount) / expectedTokenAmount,
        ) * 100;
      expect(percentDifference).toBeLessThan(5);
    }

    // Wait for the trade to process
    await wait(500);

    // Get trade history and verify the trade is recorded with the correct reason
    const tradeHistoryResponse = await teamClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;

    // Find our trade in the history
    const ourTrade = tradeHistory.trades.find(
      (trade) => trade.fromToken === fromToken && trade.toToken === toToken,
    );

    expect(ourTrade).toBeDefined();
    if (ourTrade) {
      expect(ourTrade.reason).toBe(detailedReason);
      expect(ourTrade.fromChain).toBe(BlockchainType.SVM);
      expect(ourTrade.toChain).toBe(BlockchainType.SVM);
      if (ourTrade.fromSpecificChain) {
        expect(ourTrade.fromSpecificChain).toBe(SpecificChain.SVM);
      }
      if (ourTrade.toSpecificChain) {
        expect(ourTrade.toSpecificChain).toBe(SpecificChain.SVM);
      }
    }
  });
});
