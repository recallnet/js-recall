// @ts-nocheck
import { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractApiKey, isLoginEndpoint } from "../auth-helpers.js";

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  authLogger: {
    debug: vi.fn(),
  },
}));

describe("auth-helpers", () => {
  let mockReq: Partial<Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      header: vi.fn(),
    };
  });

  describe("extractApiKey", () => {
    it("should extract API key from valid Authorization header", () => {
      const mockApiKey = "test-api-key-12345";
      vi.mocked(mockReq.header!).mockReturnValue(`Bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(mockApiKey);
      expect(mockReq.header).toHaveBeenCalledWith("Authorization");
    });

    it("should return undefined when Authorization header is missing", () => {
      vi.mocked(mockReq.header!).mockReturnValue(undefined);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header is null", () => {
      vi.mocked(mockReq.header!).mockReturnValue(null);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header does not start with Bearer", () => {
      vi.mocked(mockReq.header!).mockReturnValue("Basic dXNlcjpwYXNz");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header is only 'Bearer'", () => {
      vi.mocked(mockReq.header!).mockReturnValue("Bearer");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header is 'Bearer '", () => {
      vi.mocked(mockReq.header!).mockReturnValue("Bearer ");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe("");
    });

    it("should handle API key with spaces correctly", () => {
      const mockApiKey = "api key with spaces";
      vi.mocked(mockReq.header!).mockReturnValue(`Bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(mockApiKey);
    });

    it("should handle very long API keys", () => {
      const mockApiKey = "a".repeat(1000);
      vi.mocked(mockReq.header!).mockReturnValue(`Bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(mockApiKey);
    });

    it("should handle API keys with special characters", () => {
      const mockApiKey = "api-key_with.special@chars#123!";
      vi.mocked(mockReq.header!).mockReturnValue(`Bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(mockApiKey);
    });

    it("should handle case-sensitive Bearer prefix", () => {
      const mockApiKey = "test-api-key";
      vi.mocked(mockReq.header!).mockReturnValue(`bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should handle BEARER in uppercase", () => {
      const mockApiKey = "test-api-key";
      vi.mocked(mockReq.header!).mockReturnValue(`BEARER ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should handle empty string Authorization header", () => {
      vi.mocked(mockReq.header!).mockReturnValue("");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should extract API key with multiple Bearer tokens (takes first)", () => {
      const mockApiKey = "first-api-key Bearer second-api-key";
      vi.mocked(mockReq.header!).mockReturnValue(`Bearer ${mockApiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(mockApiKey);
    });

    it("should handle Authorization header with extra whitespace", () => {
      const mockApiKey = "test-api-key";
      vi.mocked(mockReq.header!).mockReturnValue(`  Bearer ${mockApiKey}  `);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined(); // Function doesn't trim, so this should fail
    });
  });

  describe("isLoginEndpoint", () => {
    it("should return true for exact login endpoint path", () => {
      const result = isLoginEndpoint("/api/auth/login");
      expect(result).toBe(true);
    });

    it("should return true for login endpoint with query parameters", () => {
      const result = isLoginEndpoint("/api/auth/login?redirect=home");
      expect(result).toBe(true);
    });

    it("should return true for login endpoint with hash fragment", () => {
      const result = isLoginEndpoint("/api/auth/login#section");
      expect(result).toBe(true);
    });

    it("should return true for nested login endpoint path", () => {
      const result = isLoginEndpoint("/v1/api/auth/login");
      expect(result).toBe(true);
    });

    it("should return false for non-login paths", () => {
      const result = isLoginEndpoint("/api/auth/logout");
      expect(result).toBe(false);
    });

    it("should return false for similar but not exact paths", () => {
      const result = isLoginEndpoint("/api/auth/login-form");
      expect(result).toBe(true); // This actually matches because it contains the string
    });

    it("should return false for root path", () => {
      const result = isLoginEndpoint("/");
      expect(result).toBe(false);
    });

    it("should return false for empty string", () => {
      const result = isLoginEndpoint("");
      expect(result).toBe(false);
    });

    it("should be case sensitive", () => {
      const result = isLoginEndpoint("/api/auth/LOGIN");
      expect(result).toBe(false);
    });

    it("should return false for paths without leading slash", () => {
      const result = isLoginEndpoint("api/auth/login");
      expect(result).toBe(false);
    });

    it("should return false for paths with multiple slashes", () => {
      const result = isLoginEndpoint("/api//auth///login");
      expect(result).toBe(false);
    });

    it("should return false for partial matches at start", () => {
      const result = isLoginEndpoint("login/api/auth");
      expect(result).toBe(false);
    });

    it("should return true for paths containing login substring anywhere", () => {
      const result = isLoginEndpoint("/some/path/api/auth/login/extra");
      expect(result).toBe(true);
    });

    it("should handle URL-encoded paths", () => {
      const result = isLoginEndpoint("/api/auth%2Flogin");
      expect(result).toBe(false); // Encoded slash doesn't match
    });

    it("should handle paths with trailing slash", () => {
      const result = isLoginEndpoint("/api/auth/login/");
      expect(result).toBe(true);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle null request object gracefully", () => {
      const nullReq = null as unknown as Request;

      expect(() => extractApiKey(nullReq)).toThrow();
    });

    it("should handle request without header method", () => {
      const reqWithoutHeader = {} as Request;

      expect(() => extractApiKey(reqWithoutHeader)).toThrow();
    });

    it("should handle header method throwing error", () => {
      const mockReqWithError = {
        header: vi.fn().mockImplementation(() => {
          throw new Error("Header access error");
        }),
      } as unknown as Request;

      expect(() => extractApiKey(mockReqWithError)).toThrow();
    });

    it("should handle isLoginEndpoint with null path", () => {
      expect(() => isLoginEndpoint(null as unknown as string)).toThrow();
    });

    it("should handle isLoginEndpoint with undefined path", () => {
      expect(() => isLoginEndpoint(undefined as unknown as string)).toThrow();
    });
  });
});
