import { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DeepMockProxy, mockDeep } from "vitest-mock-extended";

import {
  SelectAdmin,
  SelectAgent,
  SelectUser,
} from "@recallnet/db/schema/core/types";

import { authMiddleware } from "@/middleware/auth.middleware.js";
import { ApiError } from "@/middleware/errorHandler.js";
import { AdminService } from "@/services/admin.service.js";
import { AgentService } from "@/services/agent.service.js";
import { UserService } from "@/services/user.service.js";

// Mock dependencies
vi.mock("@/lib/logger.js", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    authLogger: mockLogger,
  };
});

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

describe("authMiddleware", () => {
  let mockAgentService: DeepMockProxy<AgentService>;
  let mockUserService: DeepMockProxy<UserService>;
  let mockAdminService: DeepMockProxy<AdminService>;
  let middleware: ReturnType<typeof authMiddleware>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock services using vitest-mock-extended
    mockAgentService = mockDeep<AgentService>();
    mockUserService = mockDeep<UserService>();
    mockAdminService = mockDeep<AdminService>();

    // Create middleware instance
    middleware = authMiddleware(
      mockAgentService,
      mockUserService,
      mockAdminService,
    );

    // Setup mock request/response
    mockReq = {
      method: "GET",
      originalUrl: "/api/test",
      protocol: "https",
      get: vi.fn().mockReturnValue("example.com"),
      header: vi.fn(),
      baseUrl: "/api",
      path: "/test",
    };

    mockRes = {} as Partial<Response>;
    mockNext = vi.fn();
  });

  describe("Privy JWT Authentication", () => {
    it("should authenticate successfully with valid Privy token and existing user", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("valid-token");
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: "privy-123",
        claims: { cr: "test", linked_accounts: [] },
      });
      mockUserService.getUserByPrivyId.mockResolvedValue({
        id: "user-123",
        walletAddress: "0x123",
      } as SelectUser);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.privyToken).toBe("valid-token");
      expect(mockReq.userId).toBe("user-123");
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAgentService.validateApiKey).not.toHaveBeenCalled();
    });

    it("should allow login endpoint access for valid token without user", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );
      const { isLoginEndpoint } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("valid-token");
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: "privy-new",
        claims: { cr: "test", linked_accounts: [] },
      });
      mockUserService.getUserByPrivyId.mockResolvedValue(null);
      vi.mocked(isLoginEndpoint).mockReturnValue(true);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.userId).toBeUndefined();
    });

    it("should reject non-login endpoint access for valid token without user", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );
      const { isLoginEndpoint } = await import("@/middleware/auth-helpers.js");
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("valid-token");
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: "privy-new",
        claims: { cr: "test", linked_accounts: [] },
      });
      mockUserService.getUserByPrivyId.mockResolvedValue(null);
      vi.mocked(isLoginEndpoint).mockReturnValue(false);
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Authentication required");
    });

    it("should fall through to API key auth when Privy token validation fails", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("invalid-token");
      vi.mocked(verifyPrivyIdentityToken).mockRejectedValue(
        new Error("Invalid token"),
      );
      vi.mocked(extractApiKey).mockReturnValue("agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue({
        id: "agent-123",
        ownerId: "owner-123",
      } as SelectAgent);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAgentService.validateApiKey).toHaveBeenCalledWith("agent-key");
      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBe("owner-123");
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should fall through to API key auth when no Privy token provided", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(undefined);
      vi.mocked(extractApiKey).mockReturnValue("agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue({
        id: "agent-123",
        ownerId: "owner-123",
      } as SelectAgent);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAgentService.validateApiKey).toHaveBeenCalledWith("agent-key");
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Agent API Key Authentication", () => {
    beforeEach(async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(undefined);
    });

    it("should authenticate successfully with valid agent API key", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("valid-agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue({
        id: "agent-123",
        ownerId: "owner-123",
        name: "Test Agent",
      } as SelectAgent);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBe("owner-123");
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAdminService.validateApiKey).not.toHaveBeenCalled();
    });

    it("should set agentId but not userId when agent owner lookup fails", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("valid-agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should fall through to admin auth when agent API key is invalid", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("invalid-agent-key");
      mockAgentService.validateApiKey.mockResolvedValue(null);
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-123",
        username: "admin",
        name: "Admin User",
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAdminService.validateApiKey).toHaveBeenCalledWith(
        "invalid-agent-key",
      );
      expect(mockReq.adminId).toBe("admin-123");
      expect(mockReq.isAdmin).toBe(true);
    });

    it("should fall through to admin auth when agent validation throws error", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("agent-key");
      mockAgentService.validateApiKey.mockRejectedValue(
        new Error("Database error"),
      );
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-123",
        username: "admin",
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAdminService.validateApiKey).toHaveBeenCalledWith("agent-key");
      expect(mockReq.adminId).toBe("admin-123");
    });
  });

  describe("Admin API Key Authentication", () => {
    beforeEach(async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(undefined);
      vi.mocked(extractApiKey).mockReturnValue("admin-key");
      mockAgentService.validateApiKey.mockResolvedValue(null);
    });

    it("should authenticate successfully with valid admin API key", async () => {
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-123",
        username: "admin",
        name: "Admin User",
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.adminId).toBe("admin-123");
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({
        id: "admin-123",
        name: "Admin User",
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should use username when name is not available", async () => {
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-123",
        username: "admin",
        name: null,
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.admin).toEqual({
        id: "admin-123",
        name: "admin",
      });
    });

    it("should set adminId even when admin lookup fails", async () => {
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.adminId).toBe("admin-123");
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should return 401 when admin API key is invalid", async () => {
      mockAdminService.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid API key");
    });

    it("should return 401 when admin validation throws error", async () => {
      mockAdminService.validateApiKey.mockRejectedValue(
        new Error("Database error"),
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    beforeEach(async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(undefined);
    });

    it("should return 401 when no authentication credentials provided", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Authentication required");
    });

    it("should return 401 when all authentication methods fail", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("invalid-key");
      mockAgentService.validateApiKey.mockResolvedValue(null);
      mockAdminService.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid API key");
    });

    it("should handle unexpected errors gracefully", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );

      vi.mocked(extractPrivyIdentityToken).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should not expose sensitive information in error messages", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("secret-key-12345");
      mockAgentService.validateApiKey.mockResolvedValue(null);
      mockAdminService.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.message).not.toContain("secret-key-12345");
    });
  });

  describe("Authentication Fallback Chain", () => {
    it("should try Privy → Agent → Admin in sequence", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      // Privy fails
      vi.mocked(extractPrivyIdentityToken).mockReturnValue("invalid-privy");
      vi.mocked(verifyPrivyIdentityToken).mockRejectedValue(
        new Error("Invalid token"),
      );

      // Agent fails
      vi.mocked(extractApiKey).mockReturnValue("some-key");
      mockAgentService.validateApiKey.mockResolvedValue(null);

      // Admin succeeds
      mockAdminService.validateApiKey.mockResolvedValue("admin-123");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-123",
        username: "admin",
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockAgentService.validateApiKey).toHaveBeenCalled();
      expect(mockAdminService.validateApiKey).toHaveBeenCalled();
      expect(mockReq.adminId).toBe("admin-123");
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should stop at first successful authentication method", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("valid-token");
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: "privy-123",
        claims: { cr: "test", linked_accounts: [] },
      });
      mockUserService.getUserByPrivyId.mockResolvedValue({
        id: "user-123",
      } as SelectUser);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should not attempt API key auth
      expect(mockAgentService.validateApiKey).not.toHaveBeenCalled();
      expect(mockAdminService.validateApiKey).not.toHaveBeenCalled();
    });
  });

  describe("Request Context Population", () => {
    beforeEach(async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(undefined);
    });

    it("should correctly populate request context for agent authentication", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-456");
      mockAgentService.getAgent.mockResolvedValue({
        id: "agent-456",
        ownerId: "owner-789",
        name: "My Agent",
      } as SelectAgent);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe("agent-456");
      expect(mockReq.userId).toBe("owner-789");
      expect(mockReq.adminId).toBeUndefined();
      expect(mockReq.isAdmin).toBeUndefined();
    });

    it("should correctly populate request context for admin authentication", async () => {
      const { extractApiKey } = await import("@/middleware/auth-helpers.js");

      vi.mocked(extractApiKey).mockReturnValue("admin-key");
      mockAgentService.validateApiKey.mockResolvedValue(null);
      mockAdminService.validateApiKey.mockResolvedValue("admin-999");
      mockAdminService.getAdmin.mockResolvedValue({
        id: "admin-999",
        username: "superadmin",
        name: "Super Admin",
      } as SelectAdmin);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.adminId).toBe("admin-999");
      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.admin).toEqual({
        id: "admin-999",
        name: "Super Admin",
      });
      expect(mockReq.agentId).toBeUndefined();
    });

    it("should correctly populate request context for Privy authentication", async () => {
      const { extractPrivyIdentityToken } = await import(
        "@/lib/privy/utils.js"
      );
      const { verifyPrivyIdentityToken } = await import(
        "@/lib/privy/verify.js"
      );

      vi.mocked(extractPrivyIdentityToken).mockReturnValue("privy-token");
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: "privy-abc",
        claims: { cr: "test", linked_accounts: [] },
      });
      mockUserService.getUserByPrivyId.mockResolvedValue({
        id: "user-xyz",
        walletAddress: "0xabc",
      } as SelectUser);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.privyToken).toBe("privy-token");
      expect(mockReq.userId).toBe("user-xyz");
      expect(mockReq.agentId).toBeUndefined();
      expect(mockReq.adminId).toBeUndefined();
    });
  });
});
