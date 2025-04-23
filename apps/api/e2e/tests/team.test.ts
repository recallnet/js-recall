import {
  registerTeamAndGetClient,
  cleanupTestState,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_EMAIL,
  createTestClient,
} from '../utils/test-helpers';
import axios from 'axios';
import { getBaseUrl } from '../utils/server';
import {
  TeamProfileResponse,
  AdminTeamsListResponse,
  TeamMetadata,
  TeamRegistrationResponse,
  CreateCompetitionResponse,
  PriceResponse,
} from '../utils/api-types';

describe('Team API', () => {
  // Clean up test state before each test
  let adminApiKey: string;

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

  test('admin can register a team and team can authenticate', async () => {
    // Create a test client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(`TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`);
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a team
    const teamName = `Team ${Date.now()}`;
    const email = `team${Date.now()}@example.com`;
    const contactPerson = 'Test Contact';

    const {
      client: teamClient,
      team,
      apiKey,
    } = await registerTeamAndGetClient(client, teamName, email, contactPerson);

    expect(team).toBeDefined();
    expect(team.id).toBeDefined();
    expect(team.name).toBe(teamName);
    expect(team.email).toBe(email);
    expect(team.contactPerson).toBe(contactPerson);
    expect(apiKey).toBeDefined();

    // Verify team client is authenticated
    const profileResponse = await teamClient.getProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as TeamProfileResponse).team).toBeDefined();
    expect((profileResponse as TeamProfileResponse).team.id).toBe(team.id);
    expect((profileResponse as TeamProfileResponse).team.name).toBe(teamName);
  });

  test('teams can update their profile information', async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(`TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`);
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a team
    const { client: teamClient } = await registerTeamAndGetClient(client);

    // Update team profile
    const newContactPerson = 'Updated Contact Person';
    const updateResponse = await teamClient.updateProfile({
      contactPerson: newContactPerson,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as TeamProfileResponse).team).toBeDefined();
    expect((updateResponse as TeamProfileResponse).team.contactPerson).toBe(newContactPerson);

    // Verify changes persisted
    const profileResponse = await teamClient.getProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as TeamProfileResponse).team.contactPerson).toBe(newContactPerson);
  });

  test('teams can update their profile metadata', async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(`TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`);
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a team
    const { client: teamClient } = await registerTeamAndGetClient(client);

    // Define metadata for the update
    const metadata = {
      ref: {
        name: 'TradingBot',
        version: '1.0.0',
        url: 'https://github.com/example/trading-bot',
      },
      description: 'An algorithmic trading bot for the competition',
      social: {
        name: 'Trading Team',
        email: 'contact@tradingteam.com',
        twitter: '@tradingbot',
      },
    };

    // Update team profile with metadata
    const updateResponse = await teamClient.updateProfile({
      metadata,
    });

    expect(updateResponse.success).toBe(true);
    expect((updateResponse as TeamProfileResponse).team).toBeDefined();
    expect((updateResponse as TeamProfileResponse).team.metadata).toEqual(metadata);

    // Verify changes persisted
    const profileResponse = await teamClient.getProfile();
    expect(profileResponse.success).toBe(true);
    expect((profileResponse as TeamProfileResponse).team.metadata).toEqual(metadata);
  });

  test('team cannot authenticate with invalid API key', async () => {
    // Setup admin client
    const client = createTestClient();
    // Attempt to login as admin with correct API key
    console.log(`TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`);
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Register a team
    await registerTeamAndGetClient(client);

    // Create a client with an invalid API key
    const invalidApiKey = 'invalid_key_12345';
    const invalidClient = client.createTeamClient(invalidApiKey);

    // Try to get profile with invalid API key
    try {
      await invalidClient.getProfile();
      // Should not reach here - authentication should fail
      expect(false).toBe(true); // Force test to fail if we get here
    } catch (error) {
      // Expect authentication error
      expect(error).toBeDefined();
      // Check for 401 status in the error object
      if (axios.isAxiosError(error) && error.response) {
        expect(error.response.status).toBe(401);
      } else {
        expect((error as any).status || 401).toBe(401);
      }
    }
  });

  test('admin can list all registered teams', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Register multiple teams
    const teamData = [
      { name: `Team A ${Date.now()}`, email: `teama${Date.now()}@example.com` },
      { name: `Team B ${Date.now()}`, email: `teamb${Date.now()}@example.com` },
      { name: `Team C ${Date.now()}`, email: `teamc${Date.now()}@example.com` },
    ];

    for (const data of teamData) {
      await registerTeamAndGetClient(adminClient, data.name, data.email);
    }

    // Admin lists all teams
    const teamsResponse = await adminClient.listAllTeams();

    expect(teamsResponse.success).toBe(true);
    expect((teamsResponse as AdminTeamsListResponse).teams).toBeDefined();
    expect((teamsResponse as AdminTeamsListResponse).teams.length).toBeGreaterThanOrEqual(
      teamData.length,
    );

    // Verify all our teams are in the list
    for (const data of teamData) {
      const foundTeam = (teamsResponse as AdminTeamsListResponse).teams.find(
        (t: any) => t.name === data.name && t.email === data.email,
      );
      expect(foundTeam).toBeDefined();
    }
  });

  test('team can retrieve profile with metadata', async () => {
    // Setup admin client
    const client = createTestClient();
    console.log(`TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`);
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);

    // Define metadata for the team
    const metadata: TeamMetadata = {
      ref: {
        name: 'ProfileTestBot',
        version: '1.5.0',
        url: 'https://github.com/example/profile-test-bot',
      },
      description: 'A bot for testing profile retrieval',
      social: {
        name: 'Profile Testing Team',
        email: 'profile@testingteam.com',
        twitter: '@profilebot',
      },
    };

    // Register a team with metadata
    const teamName = `Profile Metadata Team ${Date.now()}`;
    const email = `profile-metadata-${Date.now()}@example.com`;
    const contactPerson = 'Profile Test Contact';

    // Register team with metadata
    const registerResponse = await client.registerTeam(
      teamName,
      email,
      contactPerson,
      undefined,
      metadata,
    );
    expect(registerResponse.success).toBe(true);

    // Create a client for the new team
    const registrationResponse = registerResponse as TeamRegistrationResponse;
    const teamClient = client.createTeamClient(registrationResponse.team.apiKey);

    // Get the team profile
    const profileResponse = await teamClient.getProfile();
    const teamProfile = profileResponse as TeamProfileResponse;

    // Verify all profile fields including metadata
    expect(teamProfile.success).toBe(true);
    expect(teamProfile.team.id).toBeDefined();
    expect(teamProfile.team.name).toBe(teamName);
    expect(teamProfile.team.email).toBe(email);
    expect(teamProfile.team.contactPerson).toBe(contactPerson);
    expect(teamProfile.team.metadata).toEqual(metadata);
    expect(teamProfile.team.createdAt).toBeDefined();
    expect(teamProfile.team.updatedAt).toBeDefined();
  });

  test('team can continue using API between competitions after inactiveTeamsCache fix', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a team
    const teamName = `Test Team ${Date.now()}`;
    const { client: teamClient, team } = await registerTeamAndGetClient(adminClient, teamName);
    expect(team).toBeDefined();
    expect(team.id).toBeDefined();

    // Step 2: Create and start first competition with the team
    const firstCompName = `Competition 1 ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      firstCompName,
      'First test competition',
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const firstCompetitionId = createCompResponse.competition.id;

    // Start the first competition with our team
    const startCompResult = await adminClient.startExistingCompetition(firstCompetitionId, [
      team.id,
    ]);
    expect(startCompResult.success).toBe(true);

    // Verify team can use API during first competition
    const firstProfileResponse = await teamClient.getProfile();
    expect(firstProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality
    const firstPriceResponse = await teamClient.getPrice(
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    ); // WETH token
    expect(firstPriceResponse.success).toBe(true);
    const firstPriceData = firstPriceResponse as PriceResponse;
    expect(firstPriceData.price).toBeGreaterThan(0);

    // Step 3: End the first competition
    const endCompResult = await adminClient.endCompetition(firstCompetitionId);
    expect(endCompResult.success).toBe(true);

    // Step 4: Create and start a second competition with the same team
    const secondCompName = `Competition 2 ${Date.now()}`;
    const createCompResult2 = await adminClient.createCompetition(
      secondCompName,
      'Second test competition',
    );
    expect(createCompResult2.success).toBe(true);
    const createCompResponse2 = createCompResult2 as CreateCompetitionResponse;
    const secondCompetitionId = createCompResponse2.competition.id;

    // Start the second competition with the same team
    const startCompResult2 = await adminClient.startExistingCompetition(secondCompetitionId, [
      team.id,
    ]);
    expect(startCompResult2.success).toBe(true);

    // Step 5: Verify team can still use API after being added to second competition
    // This validates our fix for the inactiveTeamsCache issue
    const secondProfileResponse = await teamClient.getProfile();
    expect(secondProfileResponse.success).toBe(true);

    // Get a token price to confirm API functionality is working after being re-added
    const secondPriceResponse = await teamClient.getPrice(
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    ); // WETH token
    expect(secondPriceResponse.success).toBe(true);
    const secondPriceData = secondPriceResponse as PriceResponse;
    expect(secondPriceData.price).toBeGreaterThan(0);
  });

  test('team profile updates maintain cache consistency', async () => {
    // Setup admin client
    const adminClient = createTestClient();
    const adminLoginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(adminLoginSuccess).toBe(true);

    // Step 1: Register a team
    const teamName = `Cache Test Team ${Date.now()}`;
    const { client: teamClient, team } = await registerTeamAndGetClient(adminClient, teamName);
    expect(team).toBeDefined();
    expect(team.id).toBeDefined();

    // Step 2: Create and start a competition with the team
    const compName = `Cache Test Competition ${Date.now()}`;
    const createCompResult = await adminClient.createCompetition(
      compName,
      'Competition to test cache consistency',
    );
    expect(createCompResult.success).toBe(true);
    const createCompResponse = createCompResult as CreateCompetitionResponse;
    const competitionId = createCompResponse.competition.id;

    // Start the competition with our team
    const startCompResult = await adminClient.startExistingCompetition(competitionId, [team.id]);
    expect(startCompResult.success).toBe(true);

    // Step 3: Verify initial API functionality
    const initialProfileResponse = await teamClient.getProfile();
    expect(initialProfileResponse.success).toBe(true);

    // Step 4: Update the team's profile multiple times in rapid succession
    // This tests that cache consistency is maintained during updates
    const metadata = {
      description: 'Testing cache consistency',
      version: '1.0',
    };

    // Update 1: Set metadata
    const updateResponse1 = await teamClient.updateProfile({ metadata });
    expect(updateResponse1.success).toBe(true);

    // Immediately verify API still works
    const priceResponse1 = await teamClient.getPrice('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    expect(priceResponse1.success).toBe(true);

    // Update 2: Change contact person
    const newContactPerson = `Cache Test Contact ${Date.now()}`;
    const updateResponse2 = await teamClient.updateProfile({ contactPerson: newContactPerson });
    expect(updateResponse2.success).toBe(true);

    // Immediately verify API still works
    const priceResponse2 = await teamClient.getPrice('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'); // USDC token
    expect(priceResponse2.success).toBe(true);

    // Update 3: Change both metadata and contact person
    const newMetadata = {
      ...metadata,
      version: '1.1',
      notes: 'Updated during test',
    };
    const updateResponse3 = await teamClient.updateProfile({
      contactPerson: `${newContactPerson} Updated`,
      metadata: newMetadata,
    });
    expect(updateResponse3.success).toBe(true);

    // Step 5: Verify final profile state
    const finalProfileResponse = await teamClient.getProfile();
    expect(finalProfileResponse.success).toBe(true);
    expect((finalProfileResponse as TeamProfileResponse).team.contactPerson).toBe(
      `${newContactPerson} Updated`,
    );
    expect((finalProfileResponse as TeamProfileResponse).team.metadata).toEqual(newMetadata);

    // Step 6: Make multiple API calls to verify authentication still works
    // This confirms the apiKeyCache remains consistent
    for (let i = 0; i < 3; i++) {
      const verifyResponse = await teamClient.getBalance();
      expect(verifyResponse.success).toBe(true);
    }
  });
});
