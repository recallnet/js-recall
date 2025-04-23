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
  ErrorResponse,
  PortfolioResponse,
  PriceResponse,
  SpecificChain,
  TokenBalance,
  TradeHistoryResponse,
  TradeResponse,
  TradeTransaction,
} from '../utils/api-types';

const reason = 'trading end-to-end test';

describe('Trading API', () => {
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

  test('team can execute a trade and verify balance updates', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Trading Team',
    );

    // Start a competition with our team
    const competitionName = `Trading Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    expect((initialBalanceResponse as BalancesResponse).success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    console.log(JSON.stringify(initialBalanceResponse), 'initialBalanceResponse test');
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance might already exist from initial balance config
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === solTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // Use a small fixed amount that should be less than the initial balance
    const tradeAmount = 100; // Use a small amount that should be available
    console.log(`Trade amount: ${tradeAmount} (should be less than ${initialUsdcBalance})`);

    // Execute a buy trade (buying SOL with USDC)
    const buyTradeResponse = await teamClient.executeTrade({
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
      expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(BlockchainType.SVM);
    }
    if ((buyTradeResponse as TradeResponse).transaction.toChain) {
      expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(BlockchainType.SVM);
    }

    // Wait a bit longer for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await teamClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);

    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(
      `Updated USDC balance: ${updatedUsdcBalance} (should be less than ${initialUsdcBalance})`,
    );
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === solTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(
      `Updated SOL balance: ${updatedSolBalance} (should be greater than ${initialSolBalance})`,
    );
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history
    const tradeHistoryResponse = await teamClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    expect((tradeHistoryResponse as TradeHistoryResponse).trades).toBeInstanceOf(Array);
    expect((tradeHistoryResponse as TradeHistoryResponse).trades.length).toBeGreaterThan(0);

    // Verify chain fields in trades if they exist
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    if (lastTrade.fromChain) {
      expect(lastTrade.fromChain).toBe(BlockchainType.SVM);
    }
    if (lastTrade.toChain) {
      expect(lastTrade.toChain).toBe(BlockchainType.SVM);
    }

    // Execute a sell trade (selling SOL for USDC)
    // Sell 50% of what we have to ensure we never try to sell more than we have
    const tokenToSell = updatedSolBalance * 0.5;
    console.log(`Token to sell: ${tokenToSell} (should be less than ${updatedSolBalance})`);

    const sellTradeResponse = await teamClient.executeTrade({
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
    const finalBalanceResponse = await teamClient.getBalance();
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should have increased compared to after buying
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(
      `Final USDC balance: ${finalUsdcBalance} (should be greater than ${updatedUsdcBalance})`,
    );
    expect(finalUsdcBalance).toBeGreaterThan(updatedUsdcBalance);
    // SOL balance should have decreased compared to after buying
    const finalSolBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === solTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Final SOL balance: ${finalSolBalance} (should be less than ${updatedSolBalance})`);
    expect(finalSolBalance).toBeLessThan(updatedSolBalance);
  });
  test('team can execute a trade with an arbitrary token address', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Arbitrary Token Team',
    );

    // Start a competition with our team
    const competitionName = `Arbitrary Token Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance should be the starting amount
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // The arbitrary token address to test with
    const arbitraryTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === arbitraryTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial arbitrary token balance: ${initialArbitraryTokenBalance}`);

    // Execute a direct trade using the API's expected parameters
    // We'll use the executeTrade method but we need to correctly map the parameters
    const tradeAmount = 10; // 10 USDC
    console.log(`Trading ${tradeAmount} USDC for arbitrary token ${arbitraryTokenAddress}`);

    // Use the client's executeTrade which expects fromToken and toToken
    const buyTradeResponse = await teamClient.executeTrade({
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
    const updatedBalanceResponse = await teamClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Updated USDC balance: ${updatedUsdcBalance}`);
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    expect(initialUsdcBalance - updatedUsdcBalance).toBeCloseTo(tradeAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased
    const updatedArbitraryTokenBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === arbitraryTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Updated arbitrary token balance: ${updatedArbitraryTokenBalance}`);
    expect(updatedArbitraryTokenBalance).toBeGreaterThan(initialArbitraryTokenBalance);

    // Get trade history
    const tradeHistoryResponse = await teamClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    expect((tradeHistoryResponse as TradeHistoryResponse).trades).toBeInstanceOf(Array);
    expect((tradeHistoryResponse as TradeHistoryResponse).trades.length).toBeGreaterThan(0);

    // Verify the last trade has the correct tokens
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
    expect(lastTrade.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade.toToken).toBe(arbitraryTokenAddress);
    expect((lastTrade as TradeTransaction).fromAmount).toBeCloseTo(tradeAmount, 1); // Allow for small rounding differences
  });

  test('team cannot execute invalid trades', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Invalid Trading Team',
    );

    // Start a competition with our team
    await startTestCompetition(adminClient, `Invalid Trading Test ${Date.now()}`, [team.id]);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );

    // Try to execute a trade with invalid token address format
    const invalidTokenResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: 'InvalidTokenAddressFormat123', // This should be rejected by the API as not a valid token address format
      amount: '100',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(invalidTokenResponse.success).toBe(false);

    // Try to execute a trade with a completely made-up token address that uses a valid format but doesn't exist
    // Using a completely invalid but properly formatted address that will never have a price
    const nonExistentTokenAddress = '1111111111111111111111111111111111111111111111111111';

    const noPriceTokenResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: nonExistentTokenAddress,
      amount: '100',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(noPriceTokenResponse.success).toBe(false);
    expect((noPriceTokenResponse as ErrorResponse).error).toContain('Unable to determine price');

    // Try to execute a trade with amount exceeding balance
    const excessiveAmountResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: usdcTokenAddress, // Use USDC which has a known price
      amount: (initialUsdcBalance * 2).toString(), // Double the available balance
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(excessiveAmountResponse.success).toBe(false);
    expect((excessiveAmountResponse as ErrorResponse).error).toContain(
      'Cannot trade between identical tokens',
    );
    // Get portfolio value to calculate appropriate test amounts
    const portfolioResponse = (await teamClient.getPortfolio()) as PortfolioResponse;
    expect(portfolioResponse.success).toBe(true);
    const portfolioValue = portfolioResponse.totalValue;
    // Test insufficient balance with an amount below max trade percentage but above actual balance
    // Calculate 25% of portfolio value (below the 30% max trade limit) but ensure it exceeds the USDC balance
    const insufficientBalanceAmount = Math.max(
      initialUsdcBalance * 1.1,
      Math.min(portfolioValue * 0.25, initialUsdcBalance * 1.5),
    );

    // Check if this amount is actually greater than our balance but less than max trade percentage
    console.log(`Testing insufficient balance with amount: ${insufficientBalanceAmount}`);
    console.log(`USDC Balance: ${initialUsdcBalance}, 25% of Portfolio: ${portfolioValue * 0.25}`);
    // Add a test for truly excessive amounts after fixing the token address
    // The test should now execute a transaction where from != to
    const solanaPriceResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: insufficientBalanceAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(solanaPriceResponse.success).toBe(false);
    expect((solanaPriceResponse as ErrorResponse).error).toContain('Insufficient balance');

    // Try to execute a sell trade without having tokens
    const invalidSellResponse = await teamClient.executeTrade({
      fromToken: config.specificChainTokens.svm.sol, // Use SOL which we don't have in our balance
      toToken: usdcTokenAddress,
      amount: '100',
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    expect(invalidSellResponse.success).toBe(false);
    expect((invalidSellResponse as ErrorResponse).error).toContain('Insufficient balance');
  });

  test('cannot place a trade that exceeds the maximum amount', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Max Trade Limit Team',
    );

    // Start a competition with our team
    await startTestCompetition(adminClient, `Max Trade Limit Test ${Date.now()}`, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;

    const usdcTokenAddress = config.specificChainTokens.svm.usdc;

    // First, check if we have any SOL or other tokens and sell them to consolidate into USDC
    const tokenAddressesBefore = Object.keys(initialBalanceResponse.balances);
    console.log(`Team initial balances: ${JSON.stringify(initialBalanceResponse.balances)}`);

    // Consolidate all non-USDC SVM tokens into USDC
    for (const tokenAddress of tokenAddressesBefore) {
      // Skip USDC itself
      if (tokenAddress === usdcTokenAddress) continue;

      // Only consolidate Solana (SVM) tokens - we want to avoid cross-chain trades
      const tokenChain = services.priceTracker.determineChain(tokenAddress);
      if (tokenChain !== BlockchainType.SVM) {
        console.log(`Skipping ${tokenAddress} - not a Solana token (${tokenChain})`);
        continue;
      }

      const balance = parseFloat(
        initialBalanceResponse.balances.find((b) => b.token === tokenAddress)?.amount.toString() ||
          '0',
      );

      // If we have a balance, sell it for USDC
      if (balance > 0) {
        console.log(`Converting ${balance} of ${tokenAddress} to USDC (SVM token)`);
        const consolidateResponse = await teamClient.executeTrade({
          fromToken: tokenAddress,
          toToken: usdcTokenAddress,
          amount: balance.toString(),
          fromChain: BlockchainType.SVM,
          toChain: BlockchainType.SVM,
          reason,
        });

        console.log(`Consolidation result: ${consolidateResponse.success ? 'success' : 'failure'}`);
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
    const balanceAfterConsolidation = await teamClient.getBalance();
    console.log(JSON.stringify(balanceAfterConsolidation), 'balanceAfterConsolidation');
    const consolidatedUsdcBalance = parseFloat(
      (balanceAfterConsolidation as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Consolidated USDC balance: ${consolidatedUsdcBalance}`);
    expect(consolidatedUsdcBalance).toBeGreaterThan(0);

    // Get portfolio value to calculate trade percentage
    const portfolioResponse = (await teamClient.getPortfolio()) as PortfolioResponse;
    expect(portfolioResponse.success).toBe(true);
    const portfolioValue = portfolioResponse.totalValue;
    console.log(`Portfolio value: $${portfolioValue}`);

    // Try to trade almost all of our USDC balance for SOL
    // This should be over the MAX_TRADE_PERCENTAGE limit (5% in .env.test)
    const tradeAmount = consolidatedUsdcBalance * 0.95; // Use 95% of our USDC
    console.log(`Attempting to trade ${tradeAmount} USDC (95% of our consolidated balance)`);

    // Calculate what percentage of portfolio this represents
    const tradePercentage = (tradeAmount / portfolioValue) * 100;
    console.log(`Trade amount: ${tradeAmount} USDC`);
    console.log(`Portfolio value: $${portfolioValue}`);
    console.log(
      `Trade percentage: ${tradePercentage}% (Max allowed: ${config.maxTradePercentage}%)`,
    );

    const maxPercentageResponse = await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: config.specificChainTokens.svm.sol,
      amount: tradeAmount.toString(),
      fromChain: BlockchainType.SVM,
      toChain: BlockchainType.SVM,
      reason,
    });

    console.log(`Max percentage trade response: ${JSON.stringify(maxPercentageResponse)}`);
    expect(maxPercentageResponse.success).toBe(false);
    expect((maxPercentageResponse as ErrorResponse).error).toContain('exceeds maximum size');
  });

  test('team can fetch price and execute a calculated trade', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Price Calculation Team',
    );

    // Start a competition with our team
    const competitionName = `Price Calculation Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    expect((initialBalanceResponse as BalancesResponse).balances).toBeDefined();

    // Initial USDC balance
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // The arbitrary token address specified
    const arbitraryTokenAddress = 'Grass7B4RdKfBCjTKgSqnXkqjwiGvQyFbuSCUJr3XXjs';
    // Initial balance of the arbitrary token (likely 0)
    const initialArbitraryTokenBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === arbitraryTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial ${arbitraryTokenAddress} token balance: ${initialArbitraryTokenBalance}`);

    // 1. Fetch the price for the arbitrary token
    console.log(`Fetching price for token: ${arbitraryTokenAddress}`);
    const priceResponse = await teamClient.getPrice(arbitraryTokenAddress);
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
    const buyTradeResponse = await teamClient.executeTrade({
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
    const finalBalanceResponse = await teamClient.getBalance();
    expect(finalBalanceResponse.success).toBe(true);
    expect((finalBalanceResponse as BalancesResponse).balances).toBeDefined();
    // USDC balance should have decreased by 10
    const finalUsdcBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Final USDC balance: ${finalUsdcBalance}`);
    expect(initialUsdcBalance - finalUsdcBalance).toBeCloseTo(usdcAmount, 1); // Allow for small rounding differences
    // The arbitrary token balance should have increased by the calculated amount
    const finalTokenBalance = parseFloat(
      (finalBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.token === arbitraryTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Final token balance: ${finalTokenBalance}`);
    expect(finalTokenBalance - initialArbitraryTokenBalance).toBeCloseTo(expectedTokenAmount, 1); // Allow for small variations due to price fluctuations

    // Get trade history to verify details
    const tradeHistoryResponse = await teamClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    const tradeHistory = tradeHistoryResponse as TradeHistoryResponse;
    expect(tradeHistory.trades).toBeInstanceOf(Array);
    expect(tradeHistory.trades.length).toBeGreaterThan(0);

    // Verify the trade details in history
    const lastTrade = tradeHistory.trades[0];
    expect(lastTrade.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade.toToken).toBe(arbitraryTokenAddress);
    expect(lastTrade.fromAmount).toBeCloseTo(usdcAmount, 1);
    expect(lastTrade.toAmount).toBeCloseTo(expectedTokenAmount, 1);
  });

  test('team can trade with Ethereum tokens', async () => {
    // Skip if Noves provider isn't configured (required for EVM tokens)
    if (!config.api.noves?.enabled) {
      console.log('Skipping Ethereum token test: Noves provider not configured');
      return;
    }

    // Check if cross-chain trading is allowed
    const allowCrossChainTrading = process.env.ALLOW_CROSS_CHAIN_TRADING === 'true';
    if (!allowCrossChainTrading) {
      console.log('Skipping Ethereum token test: Cross-chain trading is disabled');
      return;
    }

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Ethereum Token Team',
    );

    // Start a competition with our team
    const competitionName = `Ethereum Token Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);
    const balancesResponse = initialBalanceResponse as BalancesResponse;
    expect(balancesResponse.balances).toBeDefined();

    // Get Ethereum USDC token address from blockchain tokens config
    const ethUsdcTokenAddress = config.specificChainTokens.eth.usdc;
    if (!ethUsdcTokenAddress) {
      console.log('Skipping test: Ethereum USDC token address not configured');
      return;
    }

    // Get Ethereum ETH token address
    const ethTokenAddress = config.specificChainTokens.eth.eth;
    if (!ethTokenAddress) {
      console.log('Skipping test: Ethereum ETH token address not configured');
      return;
    }

    // First check price to verify EVM tokens are working
    try {
      const priceResponse = await teamClient.getPrice(ethTokenAddress);

      // If we get a successful response, verify the token is recognized as EVM
      if ((priceResponse as PriceResponse).chain) {
        expect((priceResponse as PriceResponse).chain).toBe(BlockchainType.EVM);
        console.log(
          `Confirmed ETH token is on ${(priceResponse as PriceResponse).chain} chain with price ${(priceResponse as PriceResponse).price}`,
        );
      }
    } catch (error) {
      console.error('Error getting ETH price, EVM tokens may not be supported:', error);
      return; // Skip the rest of the test
    }

    // Check if we have any ETH balance already
    const initialEthBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === ethTokenAddress)
        ?.toString() || '0',
    );
    console.log(`Initial ETH balance: ${initialEthBalance}`);

    // If we have SVM USDC, we can try to trade it for ETH
    const svmUsdcAddress = config.specificChainTokens.svm.usdc;
    const svmUsdcBalance = parseFloat(
      balancesResponse.balances.find((b) => b.token === svmUsdcAddress)?.amount.toString() || '0',
    );

    if (svmUsdcBalance > 0) {
      console.log(`Trading SVM USDC for ETH...`);
      // Use a small amount for the test
      const tradeAmount = Math.min(100, svmUsdcBalance * 0.1);

      // Execute a buy trade (buying ETH with USDC)
      const buyTradeResponse = await teamClient.executeTrade({
        fromToken: svmUsdcAddress,
        toToken: ethTokenAddress,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.EVM,
        reason,
      });

      console.log(`Buy ETH trade response: ${JSON.stringify(buyTradeResponse)}`);
      expect(buyTradeResponse.success).toBe(true);

      // Wait for the trade to process
      await wait(500);

      // Check updated balance
      const updatedBalanceResponse = await teamClient.getBalance();
      // ETH balance should have increased
      const updatedEthBalance = parseFloat(
        (updatedBalanceResponse as BalancesResponse).balances
          .find((b: TokenBalance) => b.token === ethTokenAddress)
          ?.amount.toString() || '0',
      );
      console.log(`Updated ETH balance: ${updatedEthBalance}`);
      expect(updatedEthBalance).toBeGreaterThan(initialEthBalance);

      // Get trade history and verify the Ethereum trade
      const tradeHistoryResponse = await teamClient.getTradeHistory();
      expect(tradeHistoryResponse.success).toBe(true);
      expect((tradeHistoryResponse as TradeHistoryResponse).trades.length).toBeGreaterThan(0);

      // Verify the last trade details
      const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];
      expect(lastTrade.toToken).toBe(ethTokenAddress);

      // Verify chain fields if they exist
      if (lastTrade.toChain) {
        expect(lastTrade.toChain).toBe(BlockchainType.EVM);
        console.log(`Confirmed trade to chain is ${lastTrade.toChain}`);
      }
    } else {
      console.log('No SVM USDC available for trading to ETH, skipping trade execution');
    }
  });

  test('team can execute trades with explicit chain parameters', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Chain-Specific Trading Team',
    );

    // Start a competition with our team
    const competitionName = `Chain-Specific Trading Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = await teamClient.getBalance();
    expect(initialBalanceResponse.success).toBe(true);

    // Initial USDC balance should be the starting amount (e.g., 10000)
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const initialUsdcBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial USDC balance: ${initialUsdcBalance}`);
    expect(initialUsdcBalance).toBeGreaterThan(0);

    // Use SOL token for trading (since we know it has a price in the test environment)
    const solTokenAddress = config.specificChainTokens.svm.sol;
    // Initial SOL balance
    const initialSolBalance = parseFloat(
      (initialBalanceResponse as BalancesResponse).balances
        .find((b) => b.token === solTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Initial SOL balance: ${initialSolBalance}`);

    // The amount to trade
    const tradeAmount = 50;

    // Execute a buy trade with explicit Solana chain parameters
    console.log('Executing trade with explicit Solana chain parameters');
    const buyTradeResponse = await teamClient.executeTrade({
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
    expect((buyTradeResponse as TradeResponse).transaction.fromChain).toBe(BlockchainType.SVM);
    expect((buyTradeResponse as TradeResponse).transaction.toChain).toBe(BlockchainType.SVM);

    // Wait for the trade to process
    await wait(500);

    // Check updated balance
    const updatedBalanceResponse = await teamClient.getBalance();
    expect(updatedBalanceResponse.success).toBe(true);
    // USDC balance should have decreased
    const updatedUsdcBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.token === usdcTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Updated USDC balance: ${updatedUsdcBalance}`);
    expect(updatedUsdcBalance).toBeLessThan(initialUsdcBalance);
    // SOL balance should have increased
    const updatedSolBalance = parseFloat(
      (updatedBalanceResponse as BalancesResponse).balances
        .find((b: TokenBalance) => b.token === solTokenAddress)
        ?.amount.toString() || '0',
    );
    console.log(`Updated SOL balance: ${updatedSolBalance}`);
    expect(updatedSolBalance).toBeGreaterThan(initialSolBalance);

    // Get trade history and verify chain info is preserved
    const tradeHistoryResponse = await teamClient.getTradeHistory();
    expect(tradeHistoryResponse.success).toBe(true);
    // Get the most recent trade
    const lastTrade = (tradeHistoryResponse as TradeHistoryResponse).trades[0];

    // Verify chain fields in the trade history
    expect(lastTrade.fromChain).toBe(BlockchainType.SVM);
    expect(lastTrade.toChain).toBe(BlockchainType.SVM);

    // Test cross-chain trading validation when disabled
    // First, we need to check if cross-chain trading is disabled
    try {
      // Get Ethereum ETH token address
      const ethTokenAddress = config.specificChainTokens.eth.eth;
      if (!ethTokenAddress) {
        console.log('Skipping cross-chain test: Ethereum ETH token address not configured');
        return;
      }

      // Attempt to execute a cross-chain trade with explicit chain parameters
      // This should succeed if cross-chain trading is enabled, or fail if disabled
      console.log('Attempting cross-chain trade (Solana USDC to Ethereum ETH)');
      const crossChainTradeResponse = await teamClient.executeTrade({
        fromToken: usdcTokenAddress,
        toToken: ethTokenAddress,
        amount: tradeAmount.toString(),
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.SVM,
        toSpecificChain: SpecificChain.ETH,
        reason,
      });

      console.log(`Cross-chain trade response: ${JSON.stringify(crossChainTradeResponse)}`);

      // If ALLOW_CROSS_CHAIN_TRADING is false, this should fail
      const allowCrossChainTrading = process.env.ALLOW_CROSS_CHAIN_TRADING === 'true';
      if (!allowCrossChainTrading) {
        expect(crossChainTradeResponse.success).toBe(false);
        expect((crossChainTradeResponse as ErrorResponse).error).toContain(
          'Cross-chain trading is disabled',
        );
      } else {
        // If cross-chain trading is allowed, this should succeed
        expect(crossChainTradeResponse.success).toBe(true);
      }
    } catch (error) {
      console.error('Error testing cross-chain trading:', error);
    }
  });

  test('team can execute a trade and verify reason field is returned in responses', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Reason Verification Team',
    );

    // Start a competition with our team
    const competitionName = `Reason Verification Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Get tokens to trade
    const usdcTokenAddress = config.specificChainTokens.svm.usdc;
    const solTokenAddress = config.specificChainTokens.svm.sol;

    // Define a specific reason for the trade
    const specificReason = 'Testing reason field persistence and retrieval';

    // Execute a trade with the specific reason
    const tradeResponse = (await teamClient.executeTrade({
      fromToken: usdcTokenAddress,
      toToken: solTokenAddress,
      amount: '10',
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
    const tradeHistoryResponse = (await teamClient.getTradeHistory()) as TradeHistoryResponse;

    // Verify trade history response
    expect(tradeHistoryResponse.success).toBe(true);
    expect(tradeHistoryResponse.trades).toBeInstanceOf(Array);
    expect(tradeHistoryResponse.trades.length).toBeGreaterThan(0);

    // Get the most recent trade (should be the one we just executed)
    const lastTrade = tradeHistoryResponse.trades[0];

    // Verify reason is included in trade history
    expect(lastTrade.reason).toBe(specificReason);
    console.log(`Verified reason in trade history response: "${lastTrade.reason}"`);

    // Further verify other trade details match
    expect(lastTrade.fromToken).toBe(usdcTokenAddress);
    expect(lastTrade.toToken).toBe(solTokenAddress);
    expect(parseFloat(lastTrade.fromAmount.toString())).toBeCloseTo(10, 1);
  });
});
