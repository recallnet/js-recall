/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as privyUtils from "@/lib/privy/utils.js";
import * as privyVerify from "@/lib/privy/verify.js";
import { AdminManager } from "@/services/admin-manager.service.js";
import { AgentManager } from "@/services/agent-manager.service.js";
import { UserManager } from "@/services/user-manager.service.js";

import * as authHelpers from "../auth-helpers.js";
import { authMiddleware } from "../auth.middleware.js";
import { ApiError } from "../errorHandler.js";

// Mock dependencies
vi.mock("@/lib/logger.js", () => ({
  authLogger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../auth-helpers.js");
vi.mock("@/lib/privy/utils.js");
vi.mock("@/lib/privy/verify.js");

describe("authMiddleware", () => {
  let mockAgentManager: AgentManager;
  let mockUserManager: UserManager;
  let mockAdminManager: AdminManager;
  let middleware: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mock manager instances
    mockAgentManager = {
      validateApiKey: vi.fn(),
      getAgent: vi.fn(),
    } as any;

    mockUserManager = {
      getUserByPrivyId: vi.fn(),
    } as any;

    mockAdminManager = {
      validateApiKey: vi.fn(),
      getAdmin: vi.fn(),
    } as any;

    // Create middleware instance
    middleware = authMiddleware(
      mockAgentManager,
      mockUserManager,
      mockAdminManager,
    );

    // Setup request/response mocks
    mockReq = {
      method: "GET",
      originalUrl: "/api/test",
      protocol: "https",
      get: vi.fn().mockReturnValue("localhost:3000"),
      baseUrl: "/api",
      path: "/test",
      headers: {},
    };
    mockRes = {};
    mockNext = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Privy JWT Authentication", () => {
    it("should authenticate with valid Privy token and existing user", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-user-123";
      const mockUser = { id: "user-456", privyId: mockPrivyId };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
        claims: {
          cr: "test-cr",
          linked_accounts: [],
        },
      });
      vi.mocked(mockUserManager.getUserByPrivyId).mockResolvedValue(
        mockUser as any,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(privyUtils.extractPrivyIdentityToken).toHaveBeenCalledWith(
        mockReq,
      );
      expect(privyVerify.verifyPrivyIdentityToken).toHaveBeenCalledWith(
        mockToken,
      );
      expect(mockUserManager.getUserByPrivyId).toHaveBeenCalledWith(
        mockPrivyId,
      );
      expect(mockReq.privyToken).toBe(mockToken);
      expect(mockReq.userId).toBe(mockUser.id);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow access to login endpoint with valid token but no user", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-user-123";

      mockReq.originalUrl = "/api/auth/login";
      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
        claims: {
          cr: "test-cr",
          linked_accounts: [],
        },
      });
      vi.mocked(mockUserManager.getUserByPrivyId).mockResolvedValue(null);
      vi.mocked(authHelpers.isLoginEndpoint).mockReturnValue(true);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should reject valid token with no user on non-login endpoint", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-user-123";
      const mockApiKey = "fallback-api-key";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
        claims: {
          cr: "test-cr",
          linked_accounts: [],
        },
      });
      vi.mocked(mockUserManager.getUserByPrivyId).mockResolvedValue(null);
      vi.mocked(authHelpers.isLoginEndpoint).mockReturnValue(false);
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // The Privy token error is caught and flow continues to API key auth,
      // which ultimately fails with the final "Invalid API key" message
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (mockNext as any).mock.calls[0][0];
      expect(error.message).toContain("Invalid API key");
      expect(error.statusCode).toBe(401);
    });

    it("should fall through to API key auth when Privy token verification fails", async () => {
      const mockToken = "invalid-privy-token";
      const mockApiKey = "agent-api-key";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockRejectedValue(
        new Error("Invalid token"),
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue("agent-123");
      vi.mocked(mockAgentManager.getAgent).mockResolvedValue({
        id: "agent-123",
        ownerId: "user-456",
      } as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAgentManager.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBe("user-456");
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Agent API Key Authentication", () => {
    it("should authenticate with valid agent API key", async () => {
      const mockApiKey = "agent-api-key";
      const mockAgentId = "agent-123";
      const mockAgent = { id: mockAgentId, ownerId: "user-456" };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(mockAgentId);
      vi.mocked(mockAgentManager.getAgent).mockResolvedValue(mockAgent as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(authHelpers.extractApiKey).toHaveBeenCalledWith(mockReq);
      expect(mockAgentManager.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockAgentManager.getAgent).toHaveBeenCalledWith(mockAgentId);
      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe(mockAgent.ownerId);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle agent API key validation returning null", async () => {
      const mockApiKey = "invalid-agent-key";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (mockNext as any).mock.calls[0][0];
      expect(error.message).toContain("Invalid API key");
      expect(error.statusCode).toBe(401);
    });

    it("should fall through to admin auth when agent API key validation throws", async () => {
      const mockApiKey = "api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        id: mockAdminId,
        username: "admin",
        name: "Admin User",
      };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockRejectedValue(
        new Error("DB error"),
      );
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(mockAdminId);
      vi.mocked(mockAdminManager.getAdmin).mockResolvedValue(mockAdmin as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAdminManager.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({ id: mockAdminId, name: mockAdmin.name });
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Admin API Key Authentication", () => {
    it("should authenticate with valid admin API key", async () => {
      const mockApiKey = "admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        id: mockAdminId,
        username: "admin",
        name: "Admin User",
      };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(mockAdminId);
      vi.mocked(mockAdminManager.getAdmin).mockResolvedValue(mockAdmin as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAdminManager.validateApiKey).toHaveBeenCalledWith(mockApiKey);
      expect(mockAdminManager.getAdmin).toHaveBeenCalledWith(mockAdminId);
      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({ id: mockAdminId, name: mockAdmin.name });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should use username as name when admin name is null", async () => {
      const mockApiKey = "admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = { id: mockAdminId, username: "admin", name: null };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(mockAdminId);
      vi.mocked(mockAdminManager.getAdmin).mockResolvedValue(mockAdmin as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.admin).toEqual({
        id: mockAdminId,
        name: mockAdmin.username,
      });
    });
  });

  describe("Authentication Failures", () => {
    it("should reject request with no authentication method", async () => {
      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (mockNext as any).mock.calls[0][0];
      expect(error.message).toContain(
        "Authentication required. Invalid Privy token or no API key provided",
      );
      expect(error.statusCode).toBe(401);
    });

    it("should reject request when all authentication methods fail", async () => {
      const mockApiKey = "invalid-key";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = (mockNext as any).mock.calls[0][0];
      expect(error.message).toContain(
        "Invalid API key. This key may have been reset",
      );
      expect(error.statusCode).toBe(401);
    });

    it("should handle unexpected errors gracefully", async () => {
      const mockError = new Error("Unexpected database error");

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockImplementation(() => {
        throw mockError;
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(mockError);
    });
  });

  describe("Edge Cases", () => {
    it("should handle agent with no owner", async () => {
      const mockApiKey = "agent-api-key";
      const mockAgentId = "agent-123";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(mockAgentId);
      vi.mocked(mockAgentManager.getAgent).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle admin with no details", async () => {
      const mockApiKey = "admin-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(mockAdminId);
      vi.mocked(mockAdminManager.getAdmin).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle malformed URL in Privy auth", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-user-123";
      const mockUser = { id: "user-456", privyId: mockPrivyId };

      (mockReq as any).protocol = "invalid-protocol";
      (mockReq as any).originalUrl = "malformed-url";

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
        claims: {
          cr: "test-cr",
          linked_accounts: [],
        },
      });
      vi.mocked(mockUserManager.getUserByPrivyId).mockResolvedValue(
        mockUser as any,
      );

      // Should handle URL construction error gracefully and continue with auth
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("Request Context Setting", () => {
    it("should correctly set all request context for Privy auth", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-user-123";
      const mockUser = { id: "user-456", privyId: mockPrivyId };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        mockToken,
      );
      vi.mocked(privyVerify.verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
        claims: {
          cr: "test-cr",
          linked_accounts: [],
        },
      });
      vi.mocked(mockUserManager.getUserByPrivyId).mockResolvedValue(
        mockUser as any,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.privyToken).toBe(mockToken);
      expect(mockReq.userId).toBe("user-456");
      expect(mockReq.agentId).toBeUndefined();
      expect(mockReq.adminId).toBeUndefined();
      expect(mockReq.isAdmin).toBeUndefined();
    });

    it("should correctly set all request context for agent auth", async () => {
      const mockApiKey = "agent-api-key";
      const mockAgentId = "agent-123";
      const mockAgent = { id: mockAgentId, ownerId: "user-456" };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(mockAgentId);
      vi.mocked(mockAgentManager.getAgent).mockResolvedValue(mockAgent as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBe("user-456");
      expect(mockReq.privyToken).toBeUndefined();
      expect(mockReq.adminId).toBeUndefined();
      expect(mockReq.isAdmin).toBeUndefined();
    });

    it("should correctly set all request context for admin auth", async () => {
      const mockApiKey = "admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        id: mockAdminId,
        username: "admin",
        name: "Admin User",
      };

      vi.mocked(privyUtils.extractPrivyIdentityToken).mockReturnValue(
        undefined,
      );
      vi.mocked(authHelpers.extractApiKey).mockReturnValue(mockApiKey);
      vi.mocked(mockAgentManager.validateApiKey).mockResolvedValue(null);
      vi.mocked(mockAdminManager.validateApiKey).mockResolvedValue(mockAdminId);
      vi.mocked(mockAdminManager.getAdmin).mockResolvedValue(mockAdmin as any);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.adminId).toBe("admin-123");
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({ id: mockAdminId, name: "Admin User" });
      expect(mockReq.agentId).toBeUndefined();
      expect(mockReq.userId).toBeUndefined();
      expect(mockReq.privyToken).toBeUndefined();
    });
  });
});
