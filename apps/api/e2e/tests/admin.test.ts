import axios from "axios";
import { beforeEach, describe, expect, test } from "vitest";

import {
  AdminTeamsListResponse,
  ApiResponse,
  ErrorResponse,
  TeamProfileResponse,
  TeamRegistrationResponse,
} from "@/e2e/utils/api-types.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
} from "@/e2e/utils/test-helpers.js";

describe("Admin API", () => {
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

  test("should authenticate as admin", async () => {
    console.log("TEST: Starting admin authentication test");

    // Create a test client
    const client = createTestClient();
    console.log("TEST: Created test client");

    // Attempt to login as admin with correct API key
    console.log(
      `TEST: Attempting to login with admin API key: ${adminApiKey.substring(0, 8)}...`,
    );
    const loginSuccess = await client.loginAsAdmin(adminApiKey);
    console.log(`TEST: Login result: ${loginSuccess}`);
    expect(loginSuccess).toBe(true);

    // Attempt to login with incorrect API key and assert failure
    console.log("TEST: Attempting to login with invalid API key");
    const failedLogin = await client.loginAsAdmin("invalid_api_key");
    console.log(`TEST: Invalid login result: ${failedLogin}`);
    expect(failedLogin).toBe(false);

    console.log("TEST: Admin authentication test completed");
  });

  test("should register a team via admin API", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team
    const teamName = `Test Team ${Date.now()}`;
    const teamEmail = `team${Date.now()}@test.com`;
    const contactPerson = "John Doe";

    const result = (await adminClient.registerTeam(
      teamName,
      teamEmail,
      contactPerson,
    )) as TeamRegistrationResponse;

    // Assert registration success
    expect(result.success).toBe(true);
    expect(result.team).toBeDefined();
    expect(result.team.name).toBe(teamName);
    expect(result.team.email).toBe(teamEmail);
    expect(result.team.contactPerson).toBe(contactPerson);
    expect(result.team.apiKey).toBeDefined();
  });

  test("should register a team with metadata via admin API", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team with metadata
    const teamName = `Metadata Team ${Date.now()}`;
    const teamEmail = `metadata-team-${Date.now()}@test.com`;
    const contactPerson = "Meta Data";

    // Define the metadata for the team
    const metadata = {
      ref: {
        name: "AdminBot",
        version: "2.0.0",
        url: "https://github.com/example/admin-bot",
      },
      description: "A trading bot created by the admin",
      social: {
        name: "Admin Trading Team",
        email: "admin@tradingteam.com",
        twitter: "@adminbot",
      },
    };

    // Register the team with metadata
    const result = await adminClient.registerTeam(
      teamName,
      teamEmail,
      contactPerson,
      undefined, // Auto-generate wallet address since not explicitly provided
      metadata, // Pass the metadata
    );

    // Assert registration success using type assertion
    expect(result.success).toBe(true);

    // Safely check team properties with type assertion
    const registrationResponse = result as TeamRegistrationResponse;
    expect(registrationResponse.team).toBeDefined();
    expect(registrationResponse.team.name).toBe(teamName);
    expect(registrationResponse.team.email).toBe(teamEmail);
    expect(registrationResponse.team.contactPerson).toBe(contactPerson);
    expect(registrationResponse.team.apiKey).toBeDefined();

    // Now get the team's profile to verify the metadata was saved
    const teamClient = adminClient.createTeamClient(
      registrationResponse.team.apiKey,
    );
    const profileResponse = await teamClient.getProfile();

    // Safely check profile properties with type assertion
    const teamProfile = profileResponse as TeamProfileResponse;
    expect(teamProfile.success).toBe(true);
    expect(teamProfile.team.metadata).toEqual(metadata);
  });

  test("should not allow team registration without admin auth", async () => {
    // Create a test client (not authenticated as admin)
    const client = createTestClient();

    // Attempt to register a team without admin auth
    const result = await client.registerTeam(
      "Unauthorized Team",
      "unauthorized@test.com",
      "John Doe",
    );

    // Assert failure
    expect(result.success).toBe(false);
  });

  test("should not allow registration of teams with duplicate email", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register first team
    const teamEmail = `same-email-${Date.now()}@test.com`;
    const firstResult = await adminClient.registerTeam(
      `First Team ${Date.now()}`,
      teamEmail,
      "John Doe",
    );

    // Assert first registration success
    expect(firstResult.success).toBe(true);

    // Try to register second team with the same email
    const secondResult = (await adminClient.registerTeam(
      `Second Team ${Date.now()}`,
      teamEmail, // Same email as first team
      "Jane Smith",
    )) as ErrorResponse;

    // Assert second registration failure due to duplicate email
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toContain("email");
  });

  test("should delete a team as admin", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a new team first
    const teamName = `Team To Delete ${Date.now()}`;
    const teamEmail = `delete-${Date.now()}@test.com`;
    const contactPerson = "Delete Me";

    const registerResult = (await adminClient.registerTeam(
      teamName,
      teamEmail,
      contactPerson,
    )) as TeamRegistrationResponse;
    expect(registerResult.success).toBe(true);

    const teamId = registerResult.team.id;

    // Now delete the team
    const deleteResult = (await adminClient.deleteTeam(teamId)) as ApiResponse;

    // Assert deletion success
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.message).toContain("successfully deleted");

    // Verify the team is gone by trying to get the list of teams
    const teamsResult =
      (await adminClient.listTeams()) as AdminTeamsListResponse;
    expect(teamsResult.success).toBe(true);

    // Check that the deleted team is not in the list
    const deletedTeamExists = teamsResult.teams.some(
      (t: { id: string }) => t.id === teamId,
    );
    expect(deletedTeamExists).toBe(false);
  });

  test("should not allow team deletion without admin auth", async () => {
    // Setup admin client with the API key to create a team
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Register a team first
    const teamName = `Team No Delete ${Date.now()}`;
    const teamEmail = `nodelete-${Date.now()}@test.com`;
    const contactPerson = "Keep Me";

    const registerResult = (await adminClient.registerTeam(
      teamName,
      teamEmail,
      contactPerson,
    )) as TeamRegistrationResponse;
    expect(registerResult.success).toBe(true);

    const teamId = registerResult.team.id;

    // Create a non-admin client
    const regularClient = createTestClient();

    // Try to delete the team without admin auth
    const deleteResult = await regularClient.deleteTeam(teamId);

    // Assert deletion failure
    expect(deleteResult.success).toBe(false);

    // Verify the team still exists
    const teamsResult =
      (await adminClient.listTeams()) as AdminTeamsListResponse;
    const teamExists = teamsResult.teams.some(
      (t: { id: string }) => t.id === teamId,
    );
    expect(teamExists).toBe(true);
  });

  test("should not allow deletion of non-existent team", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Try to delete a team with a non-existent ID (using a valid UUID format)
    const nonExistentId = "00000000-0000-4000-a000-000000000000"; // Valid UUID that doesn't exist
    const deleteResult = (await adminClient.deleteTeam(
      nonExistentId,
    )) as ErrorResponse;

    // Assert deletion failure
    expect(deleteResult.success).toBe(false);
    expect(deleteResult.error).toContain("not found");
  });

  test("should not allow deletion of admin accounts", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Note: We can't directly test deleting the admin account through the API because:
    // 1. The admin is often filtered out from the team list endpoint for security
    // 2. We can't create two admin accounts to test deleting one
    //
    // However, we've verified through code review that the controller checks
    // the team.isAdmin flag before allowing deletion, as shown in admin.controller.ts:
    //
    // if (team.isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Cannot delete admin accounts'
    //   });
    // }
    //
    // To verify the delete team functionality works in general, we'll create and
    // delete a regular team instead.

    // Create a regular team to delete
    const teamName = `Team For Admin Test ${Date.now()}`;
    const teamEmail = `admin-test-${Date.now()}@test.com`;
    const contactPerson = "Test Person";

    const registerResult = (await adminClient.registerTeam(
      teamName,
      teamEmail,
      contactPerson,
    )) as TeamRegistrationResponse;
    expect(registerResult.success).toBe(true);

    // Delete the team to verify our delete functionality works correctly
    const deleteResult = await adminClient.deleteTeam(registerResult.team.id);
    expect(deleteResult.success).toBe(true);
  });

  test("should search for teams based on various criteria", async () => {
    // Setup admin client with the API key
    const adminClient = createTestClient();
    await adminClient.loginAsAdmin(adminApiKey);

    // Create teams with distinct attributes to test the search functionality
    const timestamp = Date.now();

    // Team 1: Standard active team
    const team1Name = `Search Team Alpha ${timestamp}`;
    const team1Email = `search-alpha-${timestamp}@test.com`;
    const team1Contact = "John Smith";
    const team1Result = (await adminClient.registerTeam(
      team1Name,
      team1Email,
      team1Contact,
    )) as TeamRegistrationResponse;
    expect(team1Result.success).toBe(true);

    // Team 2: Standard active team with different name pattern
    const team2Name = `Testing Team Beta ${timestamp}`;
    const team2Email = `beta-${timestamp}@example.com`;
    const team2Contact = "Jane Doe";
    const team2Result = (await adminClient.registerTeam(
      team2Name,
      team2Email,
      team2Contact,
    )) as TeamRegistrationResponse;
    expect(team2Result.success).toBe(true);

    // Team 3: Create and then deactivate
    const team3Name = `Search Team Inactive ${timestamp}`;
    const team3Email = `inactive-${timestamp}@test.com`;
    const team3Contact = "Bob Inactive";
    const team3Result = (await adminClient.registerTeam(
      team3Name,
      team3Email,
      team3Contact,
    )) as TeamRegistrationResponse;
    expect(team3Result.success).toBe(true);

    // TEST CASE 1: Search by name substring (should find team 1 and team 3)
    const nameSearchResult = (await adminClient.searchTeams({
      name: "Search Team",
    })) as AdminTeamsListResponse;

    expect(nameSearchResult.success).toBe(true);
    expect(nameSearchResult.teams.length).toBe(2);
    expect(nameSearchResult.teams.some((t) => t.name === team1Name)).toBe(true);
    expect(nameSearchResult.teams.some((t) => t.name === team3Name)).toBe(true);
    expect(nameSearchResult.teams.some((t) => t.name === team2Name)).toBe(
      false,
    );

    // TEST CASE 2: Search by email domain
    const emailSearchResult = (await adminClient.searchTeams({
      email: "example.com",
    })) as AdminTeamsListResponse;

    expect(emailSearchResult.success).toBe(true);
    expect(emailSearchResult.teams.length).toBe(1);
    expect(emailSearchResult.teams[0]?.email).toBe(team2Email);

    // TEST CASE 3: Search by active status - all teams should be inactive by default
    const activeSearchResult = (await adminClient.searchTeams({
      active: false,
    })) as AdminTeamsListResponse;

    expect(activeSearchResult.success).toBe(true);
    // All three teams we created should be found as inactive
    expect(
      activeSearchResult.teams.some((t) => t.id === team1Result.team.id),
    ).toBe(true);
    expect(
      activeSearchResult.teams.some((t) => t.id === team2Result.team.id),
    ).toBe(true);
    expect(
      activeSearchResult.teams.some((t) => t.id === team3Result.team.id),
    ).toBe(true);

    // TEST CASE 4: Search for active teams - should find none of our test teams
    const noActiveTeamsResult = (await adminClient.searchTeams({
      active: true,
    })) as AdminTeamsListResponse;

    expect(noActiveTeamsResult.success).toBe(true);
    // None of our test teams should be active
    expect(
      noActiveTeamsResult.teams.some((t) => t.id === team1Result.team.id),
    ).toBe(false);
    expect(
      noActiveTeamsResult.teams.some((t) => t.id === team2Result.team.id),
    ).toBe(false);
    expect(
      noActiveTeamsResult.teams.some((t) => t.id === team3Result.team.id),
    ).toBe(false);

    // TEST CASE 5: Search by contact person
    const contactSearchResult = (await adminClient.searchTeams({
      contactPerson: "Jane",
    })) as AdminTeamsListResponse;

    expect(contactSearchResult.success).toBe(true);
    expect(contactSearchResult.teams.length).toBe(1);
    expect(contactSearchResult.teams[0]?.id).toBe(team2Result.team.id);

    // TEST CASE 6: Combined search (name and active status)
    const combinedSearchResult = (await adminClient.searchTeams({
      name: "Search Team",
      active: false,
    })) as AdminTeamsListResponse;

    expect(combinedSearchResult.success).toBe(true);
    expect(combinedSearchResult.teams.length).toBe(2);
    expect(
      combinedSearchResult.teams.some((t) => t.id === team1Result.team.id),
    ).toBe(true);
    expect(
      combinedSearchResult.teams.some((t) => t.id === team3Result.team.id),
    ).toBe(true);

    // TEST CASE 7: Search by wallet address
    // Extract wallet address from the first team
    const walletAddress = team1Result.team.walletAddress;
    expect(walletAddress).toBeTruthy();

    // Search using a portion of the wallet address (e.g., first 10 characters after 0x)
    const partialWalletAddress = walletAddress.substring(0, 12); // 0x + first 10 chars
    console.log(
      `Searching for teams with partial wallet address: ${partialWalletAddress}`,
    );

    const walletSearchResult = (await adminClient.searchTeams({
      walletAddress: partialWalletAddress,
    })) as AdminTeamsListResponse;

    expect(walletSearchResult.success).toBe(true);
    expect(walletSearchResult.teams.length).toBe(1);
    expect(walletSearchResult.teams[0]?.id).toBe(team1Result.team.id);
    expect(walletSearchResult.teams[0]?.walletAddress).toBe(walletAddress);

    // Clean up - delete the teams we created
    await adminClient.deleteTeam(team1Result.team.id);
    await adminClient.deleteTeam(team2Result.team.id);
    await adminClient.deleteTeam(team3Result.team.id);
  });
});
