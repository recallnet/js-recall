import { cleanupTestState, createTestClient, generateRandomString } from '../utils/test-helpers';
import {
  TeamMetadata,
  TeamProfileResponse,
  TeamRegistrationResponse,
  ErrorResponse,
} from '../utils/api-types';

/**
 * Generate a valid Ethereum address
 * @returns A valid Ethereum address (0x + 40 hex characters)
 */
function generateValidEthAddress(): string {
  const chars = '0123456789abcdef';
  let address = '0x';

  // Generate 40 random hex characters
  for (let i = 0; i < 40; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return address;
}

describe('Public API', () => {
  // Clean up test state before each test
  beforeEach(async () => {
    await cleanupTestState();
  });

  test('public team registration works correctly', async () => {
    // Create a test client (no auth needed for public endpoints)
    const client = createTestClient();

    // Generate unique team information
    const teamName = `Public Team ${generateRandomString(8)}`;
    const email = `public-team-${generateRandomString(8)}@test.com`;
    const contactPerson = `Public Contact ${generateRandomString(8)}`;
    const walletAddress = generateValidEthAddress();

    // Register the team using the public endpoint
    const registerResponse = await client.publicRegisterTeam(
      teamName,
      email,
      contactPerson,
      walletAddress,
    );

    // Verify response
    expect(registerResponse.success).toBe(true);

    // Type guard to ensure we have a successful registration response
    if (!registerResponse.success) {
      throw new Error('Registration failed: ' + (registerResponse as ErrorResponse).error);
    }

    // Cast to proper type
    const response = registerResponse as TeamRegistrationResponse;

    // Check team data
    expect(response.team).toBeDefined();
    expect(response.team.id).toBeDefined();
    expect(response.team.name).toBe(teamName);
    expect(response.team.email).toBe(email);
    expect(response.team.contactPerson).toBe(contactPerson);
    expect(response.team.walletAddress).toBe(walletAddress);
    expect(response.team.apiKey).toBeDefined();

    // Verify team can authenticate with the received API key
    const teamClient = client.createTeamClient(response.team.apiKey);
    const profileResponse = await teamClient.getProfile();

    expect(profileResponse.success).toBe(true);

    // Type guard for the profile response
    if (!profileResponse.success) {
      throw new Error('Profile fetch failed: ' + (profileResponse as ErrorResponse).error);
    }

    const teamProfile = profileResponse as TeamProfileResponse;
    expect(teamProfile.team).toBeDefined();
    expect(teamProfile.team.id).toBe(response.team.id);
    expect(teamProfile.team.name).toBe(teamName);
  });

  test('public team registration with metadata works correctly', async () => {
    // Create a test client (no auth needed for public endpoints)
    const client = createTestClient();

    // Generate unique team information
    const teamName = `Public Team ${generateRandomString(8)}`;
    const email = `public-team-${generateRandomString(8)}@test.com`;
    const contactPerson = `Public Contact ${generateRandomString(8)}`;
    const walletAddress = generateValidEthAddress();

    // Define metadata for the team
    const metadata: TeamMetadata = {
      ref: {
        name: 'PublicTestBot',
        version: '1.0.0',
        url: 'https://github.com/example/public-test-bot',
      },
      description: 'A bot registered through the public API',
      social: {
        name: 'Public Testing Team',
        email: 'public@testingteam.com',
        twitter: '@publictestbot',
      },
    };

    // Register the team using the public endpoint with metadata
    const registerResponse = await client.publicRegisterTeam(
      teamName,
      email,
      contactPerson,
      walletAddress,
      metadata,
    );

    // Verify response
    expect(registerResponse.success).toBe(true);

    // Type guard to ensure we have a successful registration response
    if (!registerResponse.success) {
      throw new Error('Registration failed: ' + (registerResponse as ErrorResponse).error);
    }

    // Cast to proper type
    const response = registerResponse as TeamRegistrationResponse;

    // Check team data including metadata
    expect(response.team).toBeDefined();
    expect(response.team.id).toBeDefined();
    expect(response.team.name).toBe(teamName);
    expect(response.team.email).toBe(email);
    expect(response.team.contactPerson).toBe(contactPerson);
    expect(response.team.walletAddress).toBe(walletAddress);
    expect(response.team.apiKey).toBeDefined();
    expect(response.team.metadata).toEqual(metadata);

    // Verify team can authenticate and get the metadata
    const teamClient = client.createTeamClient(response.team.apiKey);
    const profileResponse = await teamClient.getProfile();

    expect(profileResponse.success).toBe(true);

    // Type guard for the profile response
    if (!profileResponse.success) {
      throw new Error('Profile fetch failed: ' + (profileResponse as ErrorResponse).error);
    }

    const teamProfile = profileResponse as TeamProfileResponse;
    expect(teamProfile.team).toBeDefined();
    expect(teamProfile.team.id).toBe(response.team.id);
    expect(teamProfile.team.metadata).toEqual(metadata);
  });

  test('public team registration fails with duplicate email', async () => {
    // Create a test client
    const client = createTestClient();

    // Generate team information
    const email = `duplicate-${generateRandomString(8)}@test.com`;
    const teamName1 = `Team One ${generateRandomString(8)}`;
    const teamName2 = `Team Two ${generateRandomString(8)}`;
    const contactPerson = `Contact ${generateRandomString(8)}`;

    // Register first team with valid wallet address
    const firstRegisterResponse = await client.publicRegisterTeam(
      teamName1,
      email,
      contactPerson,
      generateValidEthAddress(),
    );

    expect(firstRegisterResponse.success).toBe(true);

    // Try to register second team with same email but different wallet address
    const secondRegisterResponse = await client.publicRegisterTeam(
      teamName2,
      email,
      contactPerson,
      generateValidEthAddress(),
    );

    // Should fail with a 409 conflict
    expect(secondRegisterResponse.success).toBe(false);

    // Make sure this is an error response before accessing error properties
    if (secondRegisterResponse.success) {
      throw new Error('Expected registration to fail, but it succeeded');
    }

    const errorResponse = secondRegisterResponse as ErrorResponse;
    expect(errorResponse.status).toBe(409);
    expect(errorResponse.error).toContain('already exists');
  });
});
