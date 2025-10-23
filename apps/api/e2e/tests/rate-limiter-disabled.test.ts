import axios, { AxiosResponse } from "axios";
import { describe, expect, test } from "vitest";

import { getBaseUrl } from "@recallnet/test-utils";

describe("Rate Limiter Disabled", () => {
  test("should not rate limit when disabled", async () => {
    // This test requires the server to be started with DISABLE_RATE_LIMITER=true
    if (process.env.DISABLE_RATE_LIMITER !== "true") {
      console.warn("Skipping test: DISABLE_RATE_LIMITER is not set to 'true'");
      return;
    }

    const httpClient = axios.create({
      baseURL: getBaseUrl(),
      timeout: 10000,
    });

    const requestCount = 50;
    const responses: AxiosResponse[] = [];

    for (let i = 0; i < requestCount; i++) {
      try {
        const response = await httpClient.get("/api/agents");
        responses.push(response);
      } catch (error) {
        console.error(error);
      }
    }

    expect(responses.length).toBe(requestCount);

    // Also check that no rate-limiting headers are present
    for (const response of responses) {
      const headerKeys = Object.keys(response.headers).map((key) =>
        key.toLowerCase(),
      );
      expect(headerKeys).not.toContain("retry-after");
      expect(headerKeys).not.toContain("x-ratelimit-reset");
    }
  });
});
