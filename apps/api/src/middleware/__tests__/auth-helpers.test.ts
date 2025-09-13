/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractApiKey, isLoginEndpoint } from "../auth-helpers.js";

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  authLogger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("auth-helpers", () => {
  describe("extractApiKey", () => {
    let mockReq: Partial<Request>;

    beforeEach(() => {
      mockReq = {
        header: vi.fn(),
      };
    });

    it("should extract API key from Bearer token", () => {
      const apiKey = "test-api-key-123";
      (mockReq.header as any).mockReturnValue(`Bearer ${apiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(apiKey);
      expect(mockReq.header).toHaveBeenCalledWith("Authorization");
    });

    it("should return undefined when Authorization header is missing", () => {
      (mockReq.header as any).mockReturnValue(undefined);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header doesn't start with Bearer", () => {
      (mockReq.header as any).mockReturnValue("Basic dXNlcjpwYXNz");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should return undefined when Authorization header is just 'Bearer'", () => {
      (mockReq.header as any).mockReturnValue("Bearer");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should handle Bearer token with spaces", () => {
      const apiKey = "api-key-with-spaces";
      (mockReq.header as any).mockReturnValue(`Bearer ${apiKey}`);

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe(apiKey);
    });

    it("should extract empty string if Bearer token is empty", () => {
      (mockReq.header as any).mockReturnValue("Bearer ");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe("");
    });

    it("should handle malformed Authorization headers gracefully", () => {
      (mockReq.header as any).mockReturnValue("Bearer");

      const result = extractApiKey(mockReq as Request);

      expect(result).toBeUndefined();
    });

    it("should extract API key from Bearer token with extra content", () => {
      (mockReq.header as any).mockReturnValue(
        "Bearer api-key extra-content-should-be-ignored",
      );

      const result = extractApiKey(mockReq as Request);

      expect(result).toBe("api-key extra-content-should-be-ignored");
    });
  });

  describe("isLoginEndpoint", () => {
    it("should return true for login endpoint path", () => {
      const paths = [
        "/api/auth/login",
        "/api/auth/login/",
        "/v1/api/auth/login",
        "/api/auth/login?param=value",
        "/prefix/api/auth/login/suffix",
      ];

      paths.forEach((path) => {
        expect(isLoginEndpoint(path)).toBe(true);
      });
    });

    it("should return false for non-login endpoint paths", () => {
      const paths = [
        "/api/auth/logout",
        "/api/auth/register",
        "/api/auth/verify",
        "/api/users/login", // Different namespace
        "/login", // Missing /api/auth/
        "/api/auth", // Missing /login
        "",
        "/",
      ];

      paths.forEach((path) => {
        expect(isLoginEndpoint(path)).toBe(false);
      });
    });

    it("should match paths that contain the login endpoint substring", () => {
      const paths = [
        "/api/auth/loginextra", // Contains "/api/auth/login" as substring
        "/prefix/api/auth/login/suffix", // Contains "/api/auth/login" as substring
      ];

      paths.forEach((path) => {
        expect(isLoginEndpoint(path)).toBe(true);
      });
    });

    it("should be case sensitive", () => {
      expect(isLoginEndpoint("/api/auth/LOGIN")).toBe(false);
      expect(isLoginEndpoint("/API/AUTH/LOGIN")).toBe(false);
      expect(isLoginEndpoint("/Api/Auth/Login")).toBe(false);
    });

    it("should throw on undefined path", () => {
      expect(() => isLoginEndpoint(undefined as any)).toThrow();
    });

    it("should throw on null path", () => {
      expect(() => isLoginEndpoint(null as any)).toThrow();
    });

    it("should handle empty string path", () => {
      expect(isLoginEndpoint("")).toBe(false);
    });

    it("should handle path with query parameters", () => {
      expect(isLoginEndpoint("/api/auth/login?redirect=/dashboard")).toBe(true);
      expect(isLoginEndpoint("/api/auth/login#section")).toBe(true);
      expect(
        isLoginEndpoint("/api/auth/login?redirect=/dashboard&token=abc"),
      ).toBe(true);
    });

    it("should handle path with fragments", () => {
      expect(isLoginEndpoint("/api/auth/login#top")).toBe(true);
    });
  });
});
