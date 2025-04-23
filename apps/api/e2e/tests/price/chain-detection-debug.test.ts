import {
  createTestClient,
  cleanupTestState,
  registerTeamAndGetClient,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
} from '../../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../../utils/server';
import { ApiClient } from '../../utils/api-client';
import { PriceTracker } from '../../../src/services/price-tracker.service';
import { BlockchainType } from '../../../src/types';
import dotenv from 'dotenv';
import { TokenInfoResponse } from '../../utils/api-types';

// Load environment variables
dotenv.config();

// Test tokens - same as in other tests
const solanaTokens = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const ethereumTokens = {
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

// Skip tests if API key is not set
const apiKey = process.env.NOVES_API_KEY;
const runProviderTests = !!apiKey;

describe('Chain Detection Debug', () => {
  // Create variables for authenticated clients
  let adminClient: ApiClient;
  let client: ApiClient;
  let priceTracker: PriceTracker;
  let adminApiKey: string;

  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();

    // Create admin account directly
    const response = await axios.post(`${getBaseUrl()}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();
    console.log(`Admin API key created: ${adminApiKey.substring(0, 8)}...`);

    // Setup admin client
    adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team and get an authenticated client
    const result = await registerTeamAndGetClient(adminClient);
    client = result.client;

    // Initialize price tracker
    priceTracker = new PriceTracker();
  });

  describe('Local Chain Detection', () => {
    it('should correctly detect Solana chain locally', () => {
      // Test direct chain detection for Solana tokens
      const chain = priceTracker.determineChain(solanaTokens.SOL);
      console.log(`Determined chain for ${solanaTokens.SOL}: ${chain}`);
      expect(chain).toBe(BlockchainType.SVM);
    });

    it('should correctly detect Ethereum chain locally', () => {
      // Test direct chain detection for Ethereum tokens
      const chain = priceTracker.determineChain(ethereumTokens.ETH);
      console.log(`Determined chain for ${ethereumTokens.ETH}: ${chain}`);
      expect(chain).toBe(BlockchainType.EVM);
    });
  });

  describe('API Tests', () => {
    it('should detect Ethereum token as EVM chain', async () => {
      const response = (await client.getTokenInfo(ethereumTokens.ETH)) as TokenInfoResponse;
      console.log(`API response for Ethereum token info: ${JSON.stringify(response)}`);
      expect(response.chain).toBe(BlockchainType.EVM);
    });
  });

  // Only run provider tests if API key is available
  (runProviderTests ? describe : describe.skip)('Direct Provider Tests', () => {
    it('should fetch Ethereum price via PriceTracker', async () => {
      // Test PriceTracker (which uses providers internally)
      console.log(`Fetching ETH price via PriceTracker for token: ${ethereumTokens.ETH}`);
      const price = await priceTracker.getPrice(ethereumTokens.ETH);
      console.log(`PriceTracker ETH price response: ${price}`);
      expect(price).not.toBeNull();
      expect(typeof price?.price).toBe('number');
      expect(price?.price).toBeGreaterThan(0);
    });
  });

  describe('Token Info Tests', () => {
    it('should get token info for Ethereum tokens', async () => {
      // Test the getTokenInfo method directly since it's used for EVM tokens
      console.log(`Getting token info via PriceTracker for token: ${ethereumTokens.ETH}`);
      const tokenInfo = await priceTracker.getTokenInfo(ethereumTokens.ETH);
      console.log(`Token info response: ${JSON.stringify(tokenInfo)}`);
      expect(tokenInfo).not.toBeNull();
      if (tokenInfo) {
        expect(tokenInfo.price).toBeGreaterThan(0);
        expect(tokenInfo.chain).toBe(BlockchainType.EVM);
      }
    });
  });
});
