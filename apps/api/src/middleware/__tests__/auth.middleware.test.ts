import { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { SelectAdmin, SelectAgent } from "@recallnet/db/schema/core/types";
import { AdminService, AgentService } from "@recallnet/services";
import { ApiError } from "@recallnet/services/types";

import { extractApiKey } from "@/middleware/auth-helpers.js";
import { authMiddleware } from "@/middleware/auth.middleware.js";

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

vi.mock("@recallnet/services/lib", () => ({
  getSpecificChainBalances: vi.fn(),
  parseEvmChains: vi.fn(),
  specificChainTokens: {},
}));

vi.mock("@/middleware/auth-helpers.js", () => ({
  extractApiKey: vi.fn(),
}));

describe("authMiddleware", () => {
  let mockAgentService: DeepMockProxy<AgentService>;
  let mockAdminService: DeepMockProxy<AdminService>;
  let middleware: ReturnType<typeof authMiddleware>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock services using vitest-mock-extended
    mockAgentService = mockDeep<AgentService>();
    mockAdminService = mockDeep<AdminService>();

    // Create middleware instance
    middleware = authMiddleware(mockAgentService, mockAdminService);

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

  describe("Agent API Key Authentication", () => {
    it("should authenticate successfully with valid agent API key", async () => {
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
      vi.mocked(extractApiKey).mockReturnValue("valid-agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.agentId).toBe("agent-123");
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should fall through to admin auth when agent API key is invalid", async () => {
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
    it("should return 401 when no authentication credentials provided", async () => {
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0]?.[0] as ApiError;
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Authentication required");
    });

    it("should return 401 when all authentication methods fail", async () => {
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

    it("should not expose sensitive information in error messages", async () => {
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
    it("should try Agent → Admin in sequence", async () => {
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
      vi.mocked(extractApiKey).mockReturnValue("valid-agent-key");
      mockAgentService.validateApiKey.mockResolvedValue("agent-123");
      mockAgentService.getAgent.mockResolvedValue({
        id: "agent-123",
        ownerId: "owner-123",
      } as SelectAgent);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should not attempt admin key auth
      expect(mockAdminService.validateApiKey).not.toHaveBeenCalled();
      expect(mockReq.agentId).toBe("agent-123");
    });
  });

  describe("Request Context Population", () => {
    it("should correctly populate request context for agent authentication", async () => {
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
  });
});
