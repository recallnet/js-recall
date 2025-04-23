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
import config, { features } from '../../src/config';
import { BlockchainType, PriceReport } from '../../src/types';
import { PriceTracker } from '../../src/services/price-tracker.service';
import { MultiChainProvider } from '../../src/services/providers/multi-chain.provider';
import {
  BalancesResponse,
  SpecificChain,
  TradeHistoryResponse,
  TradeResponse,
} from '../utils/api-types';

// Log critical environment variables at test suite startup to verify which values are used
console.log('\n========== BASE TRADES TEST ENVIRONMENT CHECK ==========');
console.log(`Test is using these environment variables:`);
console.log(`- INITIAL_BASE_USDC_BALANCE = ${process.env.INITIAL_BASE_USDC_BALANCE}`);
console.log(`- ALLOW_CROSS_CHAIN_TRADING = ${process.env.ALLOW_CROSS_CHAIN_TRADING}`);
console.log(`- Imported config from ../../src/config has initial balances:`, {
  'evm.usdc': config.specificChainBalances?.eth?.usdc,
  'base.usdc': config.specificChainBalances?.base?.usdc,
});
console.log('===========================================================\n');

const reason = 'base-trades end to end tests';

describe('Base Chain Trading', () => {
  let adminApiKey: string;

  // Base tokens to test with
  const BASE_TOKENS = [
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

  // Ethereum token to test cross-chain trading restrictions
  const ETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH on Ethereum
  const ETH_CHAIN = 'eth';

  // Number of tokens to distribute funds across
  const NUM_TOKENS = BASE_TOKENS.length;

  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account
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

  afterAll(async () => {
    await cleanupTestState();
  });

  test('team can trade Base tokens with explicit chain parameters', async () => {
    console.log('[Test] Starting Base chain trading test with explicit chain parameters');

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Base Chain Trading Team',
    );

    // Start a competition with our team
    const competitionName = `Base Trading Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();

    // Get initial Base USDC balance (dynamically from API response)
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.token === BASE_USDC_ADDRESS)
        ?.amount.toString() || '0',
    );
    console.log(`Initial Base USDC balance: ${initialBaseUsdcBalance}`);
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);

    // Store initial portfolio value for later comparison
    const initialPortfolioValue = initialBaseUsdcBalance;

    // Amount to spend on each token
    const spendPerToken = initialBaseUsdcBalance / NUM_TOKENS;
    console.log(`Spending ${spendPerToken} USDC per token across ${NUM_TOKENS} Base tokens`);

    // Store token prices and expected amounts
    const tokenData = [];

    // Initialize services for direct calls
    const multiChainProvider = new MultiChainProvider();
    const priceTracker = new PriceTracker();

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

      console.log(
        `Token ${tokenAddress} price: $${price} - Expected to receive: ${expectedTokenAmount}`,
      );

      tokenData.push({
        address: tokenAddress,
        price: price,
        expectedAmount: expectedTokenAmount,
      });
    }

    // Execute trades for each token with explicit chain parameters
    for (const token of tokenData) {
      // Execute a buy trade for this token with explicit chain parameters
      console.log(`Executing trade for token ${token.address}`);

      // Log what we're doing to make debugging easier
      console.log(
        `About to execute trade from ${BASE_USDC_ADDRESS} to ${token.address} with amount ${spendPerToken}`,
      );

      // Use the API endpoint with explicit from/to token addresses
      const tradeResponse = (await teamClient.executeTrade({
        fromToken: BASE_USDC_ADDRESS, // Explicitly use Base USDC address
        toToken: token.address, // Target token to buy
        amount: spendPerToken.toString(),
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      })) as TradeResponse;

      console.log(`Trade response for ${token.address}: ${JSON.stringify(tradeResponse.success)}`);
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
    const finalBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);

    // Calculate total portfolio value after trades
    let totalActualValue = 0;

    for (const token of tokenData) {
      const tokenBalance = parseFloat(
        finalBalanceResponse.balances.find((b) => b.token === token.address)?.amount?.toString() ||
          '0',
      );
      console.log(`Final ${token.address} balance: ${tokenBalance}`);
      expect(tokenBalance).toBeGreaterThan(0);

      // Add token value to total (tokenBalance * price)
      const tokenValue = tokenBalance * token.price;
      totalActualValue += tokenValue;
    }
    // Add any remaining USDC
    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances
        .find((b) => b.token === BASE_USDC_ADDRESS)
        ?.amount?.toString() || '0',
    );
    console.log(`Final Base USDC balance: ${finalBaseUsdcBalance}`);
    totalActualValue += finalBaseUsdcBalance;

    console.log(`Total actual portfolio value after trades: $${totalActualValue}`);

    // Total expected value should be close to initial portfolio value
    // Use the dynamic initial portfolio value instead of hard-coded 5000
    const totalExpectedValue = initialPortfolioValue;

    // Verify the final portfolio value is close to the expected value
    // Allowing for some slippage but within reasonable bounds
    // The portfolio value should be within ~5% of the initial value
    const upperBound = totalExpectedValue * 1.05;
    const lowerBound = totalExpectedValue * 0.95;

    console.log(`Expected portfolio value: $${totalExpectedValue}`);
    console.log(`Acceptable range: $${lowerBound} - $${upperBound}`);

    expect(totalActualValue).toBeGreaterThanOrEqual(lowerBound);
    expect(totalActualValue).toBeLessThanOrEqual(upperBound);

    // Get trade history and verify all trades were recorded with correct chain info
    const tradeHistoryResponse = (await teamClient.getTradeHistory()) as TradeHistoryResponse;
    expect(tradeHistoryResponse.success).toBe(true);
    expect(tradeHistoryResponse.trades).toBeInstanceOf(Array);
    expect(tradeHistoryResponse.trades.length).toBeGreaterThanOrEqual(NUM_TOKENS);

    // Verify each trade in history has correct chain parameters
    for (let i = 0; i < NUM_TOKENS; i++) {
      const trade = tradeHistoryResponse.trades[i];
      expect(trade.fromChain).toBe(BlockchainType.EVM);
      expect(trade.toChain).toBe(BlockchainType.EVM);
      expect(trade.fromSpecificChain).toBe(BASE_CHAIN);
      expect(trade.toSpecificChain).toBe(BASE_CHAIN);
    }

    console.log('[Test] Completed Base chain trading test with explicit chain parameters');
  });

  test('users cannot execute cross-chain trades when ALLOW_CROSS_CHAIN_TRADING=false', async () => {
    console.log('[Test] Starting test to verify cross-chain trading restrictions');
    console.log(
      `Environment variable ALLOW_CROSS_CHAIN_TRADING = ${process.env.ALLOW_CROSS_CHAIN_TRADING}`,
    );
    console.log(
      `Features config setting: features.ALLOW_CROSS_CHAIN_TRADING = ${features.ALLOW_CROSS_CHAIN_TRADING}`,
    );

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Cross-Chain Restriction Team',
    );

    // Start a competition with our team
    const competitionName = `Cross-Chain Restriction Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();
    // Get initial Base USDC balance
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.token === BASE_USDC_ADDRESS)
        ?.amount.toString() || '0',
    );
    console.log(`Initial Base USDC balance: ${initialBaseUsdcBalance}`);
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);
    // Check for any initial ETH balance (should be zero)
    const initialEthBalance = parseFloat(
      initialBalanceResponse.balances.find((b) => b.token === ETH_ADDRESS)?.amount.toString() ||
        '0',
    );
    console.log(`Initial ETH balance: ${initialEthBalance}`);
    // If there's already ETH in the balance, this will affect our test
    if (initialEthBalance > 0) {
      console.warn(
        `⚠️ WARNING: Account already has ETH balance of ${initialEthBalance} before the test`,
      );
    }

    // Make a record of all initial balances
    console.log('Initial balances:');
    initialBalanceResponse.balances.forEach((balance) => {
      console.log(`  ${balance.token}: ${balance.amount}`);
    });

    // Attempt to execute a cross-chain trade (Base USDC to Ethereum ETH)
    console.log('Attempting cross-chain trade from Base USDC to Ethereum ETH...');
    const tradeAmount = (initialBaseUsdcBalance * 0.1).toString(); // Use 10% of balance
    console.log(`Trade amount: ${tradeAmount} USDC`);

    let errorOccurred = false;
    let errorResponse = null;

    try {
      const tradeResponse = await teamClient.executeTrade({
        fromToken: BASE_USDC_ADDRESS, // Base USDC
        toToken: ETH_ADDRESS, // Ethereum ETH
        amount: tradeAmount,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.ETH, // Different chain from fromSpecificChain
        reason,
      });

      // If we get here, the trade might have succeeded, which is unexpected if cross-chain trading is disabled
      console.log('No exception thrown. Trade response:', JSON.stringify(tradeResponse, null, 2));

      // Even if no exception is thrown, the trade should not have succeeded
      expect(tradeResponse.success).toBe(false);
      errorResponse = tradeResponse;
    } catch (error: any) {
      // Type error as any for proper handling
      // We expect an error if cross-chain trading is disabled
      errorOccurred = true;
      console.log('Exception caught. Error details:');
      console.log(`  Message: ${error.message || 'No message'}`);

      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Data: ${JSON.stringify(error.response.data, null, 2)}`);
        errorResponse = error.response.data;
      }

      expect(error).toBeDefined();

      // Verify the error message indicates cross-chain trading is disabled
      if (error.response && error.response.data) {
        const errorMsg = error.response.data.message || error.response.data.error;
        expect(errorMsg).toMatch(/cross-chain|different chain/i);
        console.log(`Received expected error message: ${errorMsg}`);
      }
    }

    // Wait to ensure any potential transaction would have been processed
    await wait(500);

    // Check final balances
    const finalBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);

    // Log all final balances
    console.log('Final balances:');
    Object.entries(finalBalanceResponse.balances).forEach(([token, amount]) => {
      console.log(`  ${token}: ${amount}`);
    });

    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances.find((b) => b.token === BASE_USDC_ADDRESS)?.amount.toString() ||
        '0',
    );
    console.log(`Final Base USDC balance: ${finalBaseUsdcBalance}`);

    // Check if any USDC was spent (which should not happen)
    const usdcDifference = initialBaseUsdcBalance - finalBaseUsdcBalance;
    console.log(`USDC difference: ${usdcDifference}`);
    // ETH balance should remain zero
    const ethBalance = parseFloat(
      finalBalanceResponse.balances.find((b) => b.token === ETH_ADDRESS)?.amount.toString() || '0',
    );
    console.log(`ETH balance: ${ethBalance}`);
    console.log(`ETH address being checked: ${ETH_ADDRESS}`);

    // CRITICAL TEST: If cross-chain trading is disabled:
    // 1. An error should occur or trade.success should be false
    // 2. No USDC should be spent
    // 3. No ETH should be received

    const crossChainEnabled = process.env.ALLOW_CROSS_CHAIN_TRADING === 'true';
    console.log(`Cross-chain trading enabled from env: ${crossChainEnabled}`);

    if (!crossChainEnabled) {
      console.log('Cross-chain trading should be disabled. Verifying test conditions:');

      // If cross-chain trading is disabled, verify nothing was spent
      if (usdcDifference > 0) {
        console.error(
          `POTENTIAL BUG: ${usdcDifference} USDC was spent despite cross-chain trades being disabled!`,
        );

        // Get trade history to see what transaction occurred
        const tradeHistory = (await teamClient.getTradeHistory()) as TradeHistoryResponse;
        console.log('Recent trades:', JSON.stringify(tradeHistory.trades.slice(0, 3), null, 2));

        // This should fail the test if USDC was actually spent on a cross-chain trade
        expect(usdcDifference).toBe(0);
      } else {
        console.log('✅ No USDC was spent - this is correct');
      }

      // Verify no ETH was received
      console.log(`ETH balance check: ${ethBalance} should be <= ${initialEthBalance}`);
      if (ethBalance > initialEthBalance) {
        console.error(
          `POTENTIAL BUG: Account has ${ethBalance} ETH (increased from ${initialEthBalance}) despite cross-chain trading being disabled!`,
        );

        // Get trade history to see what transaction occurred
        const tradeHistory = (await teamClient.getTradeHistory()) as TradeHistoryResponse;
        console.log('Recent trades:', JSON.stringify(tradeHistory.trades.slice(0, 3), null, 2));
      }
      // Instead of expecting ETH balance to be 0, check that it hasn't increased
      expect(ethBalance).toBeLessThanOrEqual(initialEthBalance);
    }

    console.log(
      `[Test] Completed test verifying cross-chain trading restrictions. Cross-chain enabled: ${crossChainEnabled}`,
    );
  });

  test('users cannot spend more than their initial balance', async () => {
    console.log('[Test] Starting test to verify spending limits');

    // Setup admin client
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register team and get client
    const { client: teamClient, team } = await registerTeamAndGetClient(
      adminClient,
      'Spending Limit Team',
    );

    // Start a competition with our team
    const competitionName = `Spending Limit Test ${Date.now()}`;
    await startTestCompetition(adminClient, competitionName, [team.id]);

    // Wait for balances to be properly initialized
    await wait(500);

    // Check initial balance
    const initialBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(initialBalanceResponse.success).toBe(true);
    expect(initialBalanceResponse.balances).toBeDefined();
    // Get initial Base USDC balance
    const initialBaseUsdcBalance = parseFloat(
      initialBalanceResponse.balances
        .find((b) => b.token === BASE_USDC_ADDRESS)
        ?.amount.toString() || '0',
    );
    console.log(`Initial Base USDC balance: ${initialBaseUsdcBalance}`);
    expect(initialBaseUsdcBalance).toBeGreaterThan(0);

    // Choose a token to trade for
    const targetToken = BASE_TOKENS[0]; // Just use the first Base token

    // Get token price to verify later using direct service call
    const multiChainProvider = new MultiChainProvider();
    const tokenPriceResponse = await multiChainProvider.getPrice(
      targetToken,
      BlockchainType.EVM,
      BASE_CHAIN,
    );
    expect(tokenPriceResponse).not.toBeNull();
    const tokenPrice = tokenPriceResponse !== null ? tokenPriceResponse : 0;

    // Attempt to spend more than the initial balance
    const excessiveAmount = (initialBaseUsdcBalance * 1.5).toString(); // 150% of balance
    console.log(
      `Attempting to spend ${excessiveAmount} USDC when only ${initialBaseUsdcBalance} is available...`,
    );

    try {
      const tradeResponse = await teamClient.executeTrade({
        fromToken: BASE_USDC_ADDRESS,
        toToken: targetToken,
        amount: excessiveAmount,
        fromChain: BlockchainType.EVM,
        toChain: BlockchainType.EVM,
        fromSpecificChain: SpecificChain.BASE,
        toSpecificChain: SpecificChain.BASE,
        reason,
      });

      expect(tradeResponse.success).toBe(false); // The test should fail here if excessive trading is allowed
    } catch (error: any) {
      // Type error as any for proper handling
      // We expect an error for insufficient funds
      console.log('Expected error:', error.message || error);
      expect(error).toBeDefined();
      // Verify the error message indicates insufficient balance
      if (error.response && error.response.data) {
        expect(error.response.data.message || error.response.data.error).toMatch(
          /insufficient|balance|not enough/i,
        );
      }
    }

    // Wait longer to ensure system state is stable after the failed trade attempt
    // This helps prevent timing issues in CI environments
    console.log('Waiting for system to stabilize after failed trade attempt...');
    await wait(5000);

    // Verify that a valid trade with proper amount works
    console.log('Now trying a valid trade with proper amount...');
    const validAmount = (initialBaseUsdcBalance * 0.5).toString(); // 50% of balance

    // Execute a valid trade
    const validTradeResponse = (await teamClient.executeTrade({
      fromToken: BASE_USDC_ADDRESS,
      toToken: targetToken,
      amount: validAmount,
      fromChain: BlockchainType.EVM,
      toChain: BlockchainType.EVM,
      fromSpecificChain: SpecificChain.BASE,
      toSpecificChain: SpecificChain.BASE,
      reason,
    })) as TradeResponse;

    // This trade should succeed
    expect(validTradeResponse.success).toBe(true);
    expect(validTradeResponse.transaction).toBeDefined();

    // Wait for trade to process
    await wait(500);

    // Check final balances
    const finalBalanceResponse = (await teamClient.getBalance()) as BalancesResponse;
    expect(finalBalanceResponse.success).toBe(true);
    // USDC balance should be reduced by the valid trade amount
    const finalBaseUsdcBalance = parseFloat(
      finalBalanceResponse.balances.find((b) => b.token === BASE_USDC_ADDRESS)?.amount.toString() ||
        '0',
    );
    const expectedRemainingUsdc = initialBaseUsdcBalance - parseFloat(validAmount);

    console.log(`Final USDC balance: ${finalBaseUsdcBalance}, Expected: ~${expectedRemainingUsdc}`);
    expect(finalBaseUsdcBalance).toBeCloseTo(expectedRemainingUsdc, 0); // Using coarse precision due to potential slippage
    // Token balance should be greater than zero
    const tokenBalance = parseFloat(
      finalBalanceResponse.balances.find((b) => b.token === targetToken)?.amount.toString() || '0',
    );
    console.log(`Acquired ${tokenBalance} of ${targetToken}`);
    expect(tokenBalance).toBeGreaterThan(0);

    // Expected token amount based on simple price calculation (allowing for slippage)
    const expectedTokenAmount = parseFloat(validAmount) / (tokenPrice ? tokenPrice.price : 1);
    console.log(`Expected ~${expectedTokenAmount} tokens based on price $${tokenPrice}`);

    // Token amount should be in a reasonable range of the expected amount
    // Using a wide tolerance due to slippage and price fluctuations
    const lowerExpected = expectedTokenAmount * 0.8;
    const upperExpected = expectedTokenAmount * 1.2;
    expect(tokenBalance).toBeGreaterThanOrEqual(lowerExpected);
    expect(tokenBalance).toBeLessThanOrEqual(upperExpected);

    console.log('[Test] Completed test verifying spending limits');
  });
});
