/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import mocked modules
import { extractPrivyIdentityToken } from "@/lib/privy/utils.js";
import { verifyPrivyIdentityToken } from "@/lib/privy/verify.js";
import { extractApiKey } from "@/middleware/auth-helpers.js";

import { optionalAuthMiddleware } from "../optional-auth.middleware.js";

// Mock dependencies
vi.mock("@/lib/privy/utils.js", () => ({
  extractPrivyIdentityToken: vi.fn(),
}));

vi.mock("@/lib/privy/verify.js", () => ({
  verifyPrivyIdentityToken: vi.fn(),
}));

vi.mock("@/middleware/auth-helpers.js", () => ({
  extractApiKey: vi.fn(),
}));

describe("optionalAuthMiddleware", () => {
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
    };

    // Mock request/response
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();

    // Create middleware instance
    middleware = optionalAuthMiddleware(
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

    it("should continue to API key auth when Privy user not found", async () => {
      const mockToken = "valid-privy-token";
      const mockPrivyId = "privy-123";
      const mockApiKey = "valid-agent-api-key";
      const mockAgentId = "agent-123";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockResolvedValue({
        privyId: mockPrivyId,
      });
      mockUserManager.getUserByPrivyId.mockResolvedValue(null);
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue({ ownerId: "user-123" });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe("user-123");
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue to API key auth when Privy token verification fails", async () => {
      const mockToken = "invalid-privy-token";
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(mockToken);
      vi.mocked(verifyPrivyIdentityToken).mockRejectedValue(
        new Error("Invalid token"),
      );
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.adminId).toBe(mockAdminId);
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

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockReq.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue to admin auth when agent validation returns null", async () => {
      const mockApiKey = "invalid-agent-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(null);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);

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

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAdmin).toBe(true);
      expect(mockReq.adminId).toBe(mockAdminId);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue as unauthenticated when admin API key validation fails", async () => {
      const mockApiKey = "invalid-admin-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAdmin).toBeUndefined();
      expect(mockReq.adminId).toBeUndefined();
      expect(mockReq.agentId).toBeUndefined();
      expect(mockReq.userId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue as unauthenticated when admin validation returns null", async () => {
      const mockApiKey = "invalid-admin-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.isAdmin).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Unauthenticated scenarios", () => {
    it("should continue as unauthenticated when no token or API key provided", async () => {
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.privyToken).toBeUndefined();
      expect(mockReq.userId).toBeUndefined();
      expect(mockReq.agentId).toBeUndefined();
      expect(mockReq.isAdmin).toBeUndefined();
      expect(mockReq.adminId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue as unauthenticated when no API key provided after Privy failure", async () => {
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should continue as unauthenticated when all authentication methods fail", async () => {
      const mockApiKey = "invalid-api-key";

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );
      mockAdminManager.validateApiKey.mockRejectedValue(
        new Error("Invalid key"),
      );

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Error handling", () => {
    it("should continue as unauthenticated on unexpected errors", async () => {
      vi.mocked(extractPrivyIdentityToken).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should log unexpected errors to console", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.mocked(extractPrivyIdentityToken).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[OptionalAuthMiddleware] Unexpected error:",
        expect.any(Error),
      );
      expect(mockNext).toHaveBeenCalledWith();

      consoleSpy.mockRestore();
    });

    it("should handle service method throwing non-Error objects", async () => {
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue("test-key");
      mockAgentManager.validateApiKey.mockImplementation(() => {
        throw "String error";
      });
      mockAdminManager.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Edge cases", () => {
    it("should handle missing request object gracefully", async () => {
      const nullReq = null;
      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);

      await middleware(nullReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle agent with undefined ownerId", async () => {
      const mockApiKey = "valid-agent-api-key";
      const mockAgentId = "agent-123";
      const mockAgent = { ownerId: undefined };

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue(mockAgent);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe(undefined);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle agent with null ownerId", async () => {
      const mockApiKey = "valid-agent-api-key";
      const mockAgentId = "agent-123";
      const mockAgent = { ownerId: null };

      vi.mocked(extractPrivyIdentityToken).mockReturnValue(null);
      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAgentManager.validateApiKey.mockResolvedValue(mockAgentId);
      mockAgentManager.getAgent.mockResolvedValue(mockAgent);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.agentId).toBe(mockAgentId);
      expect(mockReq.userId).toBe(null);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
