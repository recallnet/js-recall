import axios from "axios";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { config } from "@/config/index.js";
import { ApiClient } from "@/e2e/utils/api-client.js";
import { getBaseUrl } from "@/e2e/utils/server.js";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  cleanupTestState,
  createTestClient,
} from "@/e2e/utils/test-helpers.js";

describe("CORS Configuration", () => {
  const baseUrl = getBaseUrl();
  const domain = config.app.domain;
  const corsOrigins = [
    `https://foo${domain}`,
    `https://bar${domain}`,
    `https://${domain!.substring(1)}`, // The primary domain (removing the leading dot)
  ];

  // Admin client for creating users/agents
  let adminClient: ApiClient;
  let adminApiKey: string;

  beforeAll(async () => {
    expect(domain).to.be.equal(".example.com");
  });

  beforeEach(async () => {
    await cleanupTestState();
    // Create admin account directly using the setup endpoint
    const response = await axios.post(`${baseUrl}/api/admin/setup`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      email: ADMIN_EMAIL,
    });

    // Store the admin API key for authentication
    adminApiKey = response.data.admin.apiKey;
    expect(adminApiKey).toBeDefined();

    // Create admin client
    adminClient = createTestClient();
    const loginSuccess = await adminClient.loginAsAdmin(adminApiKey);
    expect(loginSuccess).toBe(true);
  });

  // Note: we test the `/competitions` endpoint since `/docs` and `/health` are unprotected
  it("should allow requests from configured origins", async () => {
    const testEndpoint = `${baseUrl}/competitions`;

    // Test with different origin headers
    const responses = await Promise.all([
      // Assuming these are in your corsOrigins config
      axios.get(testEndpoint, {
        headers: { Origin: corsOrigins[0] },
        validateStatus: () => true, // Allow any status code
      }),
      axios.get(testEndpoint, {
        headers: { Origin: corsOrigins[1] },
        validateStatus: () => true,
      }),
      axios.get(testEndpoint, {
        headers: { Origin: corsOrigins[2] },
        validateStatus: () => true,
      }),
    ]);

    // Verify CORS headers are present and correct
    responses.forEach((response) => {
      expect(response.headers["access-control-allow-origin"]).toBeDefined();
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });
  });

  it("should handle preflight requests correctly", async () => {
    const testEndpoint = `${baseUrl}/competitions`;

    const response = await axios.options(testEndpoint, {
      headers: {
        Origin: corsOrigins[0],
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type,Authorization",
      },
      validateStatus: () => true,
    });

    expect(response.headers["access-control-allow-origin"]).toBeDefined();
    expect(response.headers["access-control-allow-methods"]).toBeDefined();
    expect(response.headers["access-control-allow-headers"]).toBeDefined();
    expect(response.status).toBe(204);
  });

  it("should reject requests from non-allowed origins", async () => {
    const testEndpoint = `${baseUrl}/competitions`;

    const response = await axios.get(testEndpoint, {
      headers: { Origin: "https://malicious-site.com" },
      validateStatus: () => true,
    });

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-methods"]).toBeUndefined();
    expect(
      response.headers["access-control-allow-credentials"],
    ).toBeUndefined();
  });
});
