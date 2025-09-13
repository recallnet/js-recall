/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import mocked modules
import { extractPrivyIdentityToken } from "@/lib/privy/utils.js";
import { verifyPrivyIdentityToken } from "@/lib/privy/verify.js";
import { extractApiKey, isLoginEndpoint } from "@/middleware/auth-helpers.js";

import { authMiddleware } from "../auth.middleware.js";
import { ApiError } from "../errorHandler.js";

// Mock dependencies
vi.mock("@/lib/logger.js", () => ({
  authLogger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/privy/utils.js", () => ({
  extractPrivyIdentityToken: vi.fn(),
}));

vi.mock("@/lib/privy/verify.js", () => ({
  verifyPrivyIdentityToken: vi.fn(),
}));

vi.mock("@/middleware/auth-helpers.js", () => ({
  extractApiKey: vi.fn(),
  isLoginEndpoint: vi.fn(),
}));

vi.mock("@/middleware/errorHandler.js", () => ({
  ApiError: class MockApiError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

describe("authMiddleware", () => {
  let mockAgentManager: any;
  let mockUserManager: any;
  let mockAdminManager: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let middleware: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock services
    mockAgentManager = {
      validateApiKey: vi.fn(),
      getAgent: vi.fn(),
    };

    mockUserManager = {
      getUserByPrivyId: vi.fn(),
    };

    mockAdminManager = {
      validateApiKey: vi.fn(),
      getAdmin: vi.fn(),
    };

    // Mock request/response
    mockReq = {
      method: "GET",
      originalUrl: "/api/test",
      protocol: "https",
      get: vi.fn().mockReturnValue("localhost"),
      baseUrl: "/api",
      path: "/test",
    };
    mockRes = {};
    mockNext = vi.fn();

    // Create middleware instance
    middleware = authMiddleware(
      mockAgentManager,
      mockUserManager,
      mockAdminManager,
    );
  });

  describe("Privy identity token authentication", () => {
    it("should authenticate successfully with valid Privy token and existing user", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-123";
      const mockUser = { id: "user-123", privyId: mockPrivyId };

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
      });
      mockUserManager.getUserByPrivyId.mockResolvedValue(mockUser);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.privyToken).toBe(mockToken);
      expect(mockReq.userId).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should allow login endpoint access when user not found with valid Privy token", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-123";

      mockReq.originalUrl = "/api/auth/login";
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
      });
      mockUserManager.getUserByPrivyId.mockResolvedValue(null);
      vi.mocked(isLoginEndpoint).mockReturnValue(true);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should fall back to API key auth when user not found with valid Privy token", async () => {
      // Note: Current middleware implementation catches the "User not found" error
      // and continues to API key authentication. This test reflects actual behavior.
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-123";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
      });
      mockUserManager.getUserByPrivyId.mockResolvedValue(null);
      vi.mocked(isLoginEndpoint).mockReturnValue(false);
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Authentication required");
    });

    it("should continue to API key auth when Privy token verification fails", async () => {
      const mockToken = "invalid-privy-token";
      const mockApiKey = "valid-api-key";
      const mockAgentId = "agent-123";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockRejectedValue(
        new Error("Invalid token"),
      );
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue({
        ownerId: "user-123",
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe("user-123");
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Agent API key authentication", () => {
    beforeEach(() => {
      // No Privy token
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
    });

    it("should authenticate successfully with valid agent API key", async () => {
      const mockApiKey = "valid-agent-api-key";
      const mockAgentId = "agent-123";
      const mockAgent = { ownerId: "user-123" };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue(mockAgent);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe(mockAgent.ownerId);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should authenticate agent without owner when agent exists but owner lookup fails", async () => {
      const mockApiKey = "valid-agent-api-key";
      const mockAgentId = "agent-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue to admin auth when agent API key validation fails", async () => {
      const mockApiKey = "invalid-agent-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue({
        username: "admin-user",
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Admin API key authentication", () => {
    beforeEach(() => {
      // No Privy token or agent authentication
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      mockAgentManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );
    });

    it("should authenticate successfully with valid admin API key", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        name: "Admin User",
      };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(mockAdmin);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({
        id: mockAdminId,
        name: mockAdmin.name,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should authenticate admin with username fallback when name is missing", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        name: null,
      };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(mockAdmin);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.admin).toEqual({
        id: mockAdminId,
        name: mockAdmin.username,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should authenticate even when admin lookup fails", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Authentication failures", () => {
    beforeEach(() => {
      // No authentication methods succeed
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
    });

    it("should throw 401 when no API key provided", async () => {
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Authentication required");
    });

    it("should throw 401 when API key is invalid for all auth methods", async () => {
      const mockApiKey = "invalid-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );
      mockAdminManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid API key");
    });

    it("should throw 401 when agent validation returns null/falsy", async () => {
      const mockApiKey = "invalid-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(null);
      mockAdminManager.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid API key");
    });
  });

  describe("Error handling", () => {
    beforeEach(() => {
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
    });

    it("should handle unexpected errors gracefully", async () => {
      vi.mocked(extractApiKey).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should propagate existing ApiErrors", async () => {
      const customError = new ApiError(403, "Custom error");
      vi.mocked(extractApiKey).mockImplementation(() => {
        throw customError;
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(customError);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing request properties gracefully", async () => {
      const minimalReq = {};
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(minimalReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
    });

    it("should handle malformed URL in Privy auth", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-123";

      mockReq.protocol = undefined;
      mockReq.get = vi.fn().mockReturnValue(undefined);
      mockReq.originalUrl = "malformed-url";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
      });
      mockUserManager.getUserByPrivyId.mockResolvedValue({ id: "user-123" });

      // Should not throw due to URL construction
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
