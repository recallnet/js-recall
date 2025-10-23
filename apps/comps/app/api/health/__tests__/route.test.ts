import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../route";

// Mock dependencies
vi.mock("@/config/private", () => ({
  config: {
    healthCheck: {
      apiKey: "test-api-key",
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Import after mocking
const { config } = await import("@/config/private");
const { db } = await import("@/lib/db");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when no authorization header is provided", async () => {
      const request = new NextRequest("http://localhost:3001/api/health");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: "error",
        message: "Unauthorized. Valid bearer token required.",
      });
    });

    it("should return 401 when authorization header does not start with Bearer", async () => {
      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Basic invalid-token",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: "error",
        message: "Unauthorized. Valid bearer token required.",
      });
    });

    it("should return 401 when bearer token is invalid", async () => {
      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: "error",
        message: "Unauthorized. Valid bearer token required.",
      });
    });

    it("should return 401 when HEALTH_CHECK_API_KEY is not set", async () => {
      // Temporarily override the config
      const originalApiKey = config.healthCheck.apiKey;
      (config.healthCheck as { apiKey?: string }).apiKey = undefined;

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer any-token",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: "error",
        message: "Unauthorized. Valid bearer token required.",
      });

      // Restore original value
      config.healthCheck.apiKey = originalApiKey;
    });

    it("should accept valid bearer token", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as never);

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Database Connection", () => {
    it("should return 200 with healthy status when database connection succeeds", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as never);

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: "ok",
        service: "comps",
        checks: {
          database: {
            healthy: true,
            message: "Database connection successful",
          },
        },
      });
      expect(data.timestamp).toBeDefined();
      expect(data.checks.database.latencyMs).toBeTypeOf("number");
      expect(data.checks.database.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify db.execute was called
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it("should return 503 with degraded status when database connection fails", async () => {
      const dbError = new Error("Connection timeout");
      vi.mocked(db.execute).mockRejectedValueOnce(dbError);

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toMatchObject({
        status: "degraded",
        service: "comps",
        checks: {
          database: {
            healthy: false,
            message: "Connection timeout",
          },
        },
      });
      expect(data.timestamp).toBeDefined();
      expect(data.checks.database.latencyMs).toBeTypeOf("number");
      expect(data.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle non-Error database failures gracefully", async () => {
      vi.mocked(db.execute).mockRejectedValueOnce("Unknown error");

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toMatchObject({
        status: "degraded",
        service: "comps",
        checks: {
          database: {
            healthy: false,
            message: "Unknown database error",
          },
        },
      });
    });

    it("should include latency measurement in response", async () => {
      // Mock a delay in database response
      vi.mocked(db.execute).mockImplementation((async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [] as never;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any);

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.checks.database.latencyMs).toBeGreaterThan(0);
      expect(data.checks.database.latencyMs).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe("Response Format", () => {
    it("should return correct response format with all required fields", async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as never);

      const request = new NextRequest("http://localhost:3001/api/health", {
        headers: {
          authorization: "Bearer test-api-key",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      // Check structure
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("service");
      expect(data).toHaveProperty("checks");
      expect(data.checks).toHaveProperty("database");
      expect(data.checks.database).toHaveProperty("healthy");
      expect(data.checks.database).toHaveProperty("message");
      expect(data.checks.database).toHaveProperty("latencyMs");

      // Check types
      expect(typeof data.status).toBe("string");
      expect(typeof data.timestamp).toBe("string");
      expect(typeof data.service).toBe("string");
      expect(typeof data.checks.database.healthy).toBe("boolean");
      expect(typeof data.checks.database.message).toBe("string");
      expect(typeof data.checks.database.latencyMs).toBe("number");

      // Check timestamp is valid ISO string
      expect(() => new Date(data.timestamp)).not.toThrow();
      expect(data.service).toBe("comps");
    });
  });
});
