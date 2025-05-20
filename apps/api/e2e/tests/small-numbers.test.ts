import axios from "axios";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import config from "@/config/index.js";
import {
  BalancesResponse,
  BlockchainType,
  ErrorResponse,
  PriceResponse,
  SpecificChain,
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
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";
import { ServiceRegistry } from "@/services/index.js";

const reason = "testing extremely small token prices";

// Mock token with an extremely small price
const SMALL_PRICE_TOKEN = {
  address: "SmallPriceToken111111111111111111111111111",
  price: 2.938e-27, // Extremely small price
  name: "Tiny Price Token",
  chain: BlockchainType.SVM,
  specificChain: SpecificChain.SVM,
};

describe("Small Numbers Trading Tests", () => {
  const services = new ServiceRegistry();
  let adminApiKey: string;
  let originalGetPrice: any;

  // Set up mock for price tracker before running tests
  beforeEach(async () => {
    // Clean up test state
    await cleanupTestState();

    // Create admin account
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store admin API key
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();

    // Store the original getPrice method
    originalGetPrice = services.priceTracker.getPrice;

    // Mock the price tracker's getPrice method
    services.priceTracker.getPrice = async function (
      tokenAddress: string,
      blockchainType?: BlockchainType,
      specificChain?: SpecificChain,
    ) {
      // If the token address matches our mock token, return the mock price
      if (tokenAddress === SMALL_PRICE_TOKEN.address) {
        return {
          price: SMALL_PRICE_TOKEN.price,
          token: tokenAddress,
          chain: SMALL_PRICE_TOKEN.chain,
          specificChain: SMALL_PRICE_TOKEN.specificChain,
          timestamp: new Date(),
        };
      }

      // Otherwise, call the original method
      return originalGetPrice.call(
        this,
        tokenAddress,
        blockchainType,
        specificChain,
      );
    };
  });

  // Restore original getPrice method after tests
  afterEach(() => {
    if (originalGetPrice) {
      services.priceTracker.getPrice = originalGetPrice;
    }
  });

  test("can execute a trade with a token that has an extremely small price", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Small Price Testing Team",
    );

    // Start a competition
    const competitionName = `Small Price Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial USDC balance
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Check if our mock price is working by getting the price of our mock token
    const priceResponse = await teamClient.getPrice(SMALL_PRICE_TOKEN.address);
    expect(priceResponse.success).toBe(true);
    expect((priceResponse as PriceResponse).price).toBe(
      SMALL_PRICE_TOKEN.price,
    );
    console.log(`Mock token price: $${(priceResponse as PriceResponse).price}`);

    // Calculate expected token amount (very large number)
    const tradeAmount = 5000; // 5,000 USDC
    const expectedTokenAmount = tradeAmount / SMALL_PRICE_TOKEN.price;
    console.log(
      `Expected token amount from ${tradeAmount} USDC: ${expectedTokenAmount}`,
    );

    // Execute a trade with the mock token
    const tradeResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: SMALL_PRICE_TOKEN.address,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    // Verify the trade executed successfully
    console.log(`Trade response: ${JSON.stringify(tradeResponse)}`);
    expect(tradeResponse.success).toBe(true);

    // Verify trade details
    const trade = (tradeResponse as TradeResponse).transaction;
    expect(trade.fromToken).toBe(usdcTokenAddress);
    expect(trade.toToken).toBe(SMALL_PRICE_TOKEN.address);
    expect(trade.fromAmount).toBe(tradeAmount);

    // Verify the toAmount is correctly calculated as an extremely large number
    expect(trade.toAmount).toBeCloseTo(expectedTokenAmount, 0); // Allow large precision differences

    // Wait for the trade to process
    await wait(500);

    // Check updated balances
    const updatedBalanceResponse = await teamClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);

    // Verify USDC balance decreased by trade amount
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === usdcTokenAddress)
        ?.amount.toString() || "0",
    );
    console.log(`Updated USDC balance: ${updatedUsdcBalance}`);
    expect(updatedUsdcBalance).toBeCloseTo(initialUsdcBalance - tradeAmount, 1);

    // Verify new token balance
    const tokenBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === SMALL_PRICE_TOKEN.address)
        ?.amount.toString() || "0",
    );
    console.log(`Small price token balance: ${tokenBalance}`);
    expect(tokenBalance).toBeGreaterThan(0);

    // For extremely large numbers, we should verify the order of magnitude is approximately correct
    const expectedMagnitude = Math.floor(Math.log10(expectedTokenAmount));
    const actualMagnitude = Math.floor(Math.log10(tokenBalance));
    console.log(
      `Expected magnitude: ${expectedMagnitude}, Actual magnitude: ${actualMagnitude}`,
    );
    expect(actualMagnitude).toBeCloseTo(expectedMagnitude, 1);

    // Verify we can trade back (selling the small price token)
    const sellAmount = tokenBalance * 0.1; // Sell 10% of the balance
    console.log(`Selling ${sellAmount} of small price token`);

    const sellTradeResponse = await teamClient.executeTrade({
      fromToken: SMALL_PRICE_TOKEN.address,
      toToken: usdcTokenAddress,
      amount: sellAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "selling token with extremely small price",
    });

    // Verify the sell trade executed successfully
    expect(sellTradeResponse.success).toBe(true);

    // Verify the final balances after selling
    const finalBalanceResponse = await teamClient.getBalance();
    const finalTokenBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.tokenAddress === SMALL_PRICE_TOKEN.address)
        ?.amount.toString() || "0",
    );
    console.log(`Final small price token balance: ${finalTokenBalance}`);
    expect(finalTokenBalance).toBeLessThan(tokenBalance);
  });

  test("can execute a trade with a token that has a normal price but results in very small USD amount", async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminApiKey,
      "Small Amount Testing Team",
    );

    // Start a competition
    const competitionName = `Small Amount Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Use SOL token for testing small amount trades
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Get SOL price
    const priceResponse = await teamClient.getPrice(solTokenAddress);
    expect(priceResponse.success).toBe(true);
    const solPrice = (priceResponse as PriceResponse).price || 0;
    expect(solPrice).toBeGreaterThan(0);
    console.log(`SOL price: $${solPrice}`);

    // Execute a very small trade (0.0001 USDC → SOL)
    const smallTradeAmount = 0.0001; // A very small amount of USDC
    const expectedSolAmount = smallTradeAmount / solPrice;
    console.log(
      `Expected SOL amount from ${smallTradeAmount} USDC: ${expectedSolAmount}`,
    );

    const tradeResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: smallTradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason: "testing very small trade amount",
    });

    // Check if the trade succeeded or failed with the expected error
    if (tradeResponse.success) {
      console.log("Small trade executed successfully");

      // Verify the toAmount is correctly calculated
      expect((tradeResponse as TradeResponse).transaction.toAmount).toBeCloseTo(
        expectedSolAmount,
        10,
      );

      // Wait for the trade to process
      await wait(500);

      // Verify updated balances
      const updatedBalanceResponse = await teamClient.getBalance();
      const solBalance = parseFloat(
        (updatedBalanceResponse as BalancesResponse).balances
          .find((b) => b.tokenAddress === solTokenAddress)
          ?.amount.toString() || "0",
      );
      console.log(`SOL balance after small trade: ${solBalance}`);
      expect(solBalance).toBeGreaterThan(0);
    } else {
      // If the trade failed, verify it was due to expected reasons (e.g., minimum trade size limit)
      console.log(
        `Small trade failed: ${(tradeResponse as ErrorResponse).error}`,
      );
      expect((tradeResponse as ErrorResponse).error).toContain("too small");
    }
  });
});
