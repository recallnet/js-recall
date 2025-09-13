/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import mocked modules
import { extractApiKey } from "@/middleware/auth-helpers.js";

import { adminAuthMiddleware } from "../admin-auth.middleware.js";
import { ApiError } from "../errorHandler.js";

// Mock dependencies
vi.mock("@/lib/logger.js", () => ({
  middlewareLogger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/middleware/auth-helpers.js", () => ({
  extractApiKey: vi.fn(),
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

describe("adminAuthMiddleware", () => {
  let mockAdminManager: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let middleware: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock admin manager
    mockAdminManager = {
      validateApiKey: vi.fn(),
      getAdmin: vi.fn(),
    };

    // Mock request/response
    mockReq = {
      method: "GET",
      originalUrl: "/api/admin/test",
      header: vi.fn(),
    };
    mockRes = {};
    mockNext = vi.fn();

    // Create middleware instance
    middleware = adminAuthMiddleware(mockAdminManager);
  });

  describe("Successful authentication", () => {
    it("should authenticate successfully with valid admin API key and active status", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        name: "Admin User",
        status: "active",
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
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should authenticate with username fallback when name is missing", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        name: null,
        status: "active",
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

    it("should authenticate with empty name fallback to username", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        name: "",
        status: "active",
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
  });

  describe("Authentication failures", () => {
    it("should throw 401 when no API key provided", async () => {
      vi.mocked(extractApiKey).mockReturnValue(undefined);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Admin authentication required");
    });

    it("should throw 401 when API key is null", async () => {
      vi.mocked(extractApiKey).mockReturnValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Admin authentication required");
    });

    it("should throw 401 when admin API key validation fails", async () => {
      const mockApiKey = "invalid-admin-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("Invalid admin API key");
    });

    it("should throw 401 when admin API key validation returns undefined", async () => {
      const mockApiKey = "invalid-admin-api-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(undefined);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it("should throw 403 when admin not found", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(null);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Admin access denied - account inactive");
    });

    it("should throw 403 when admin status is not active", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        status: "inactive",
      };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(mockAdmin);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain("Admin access denied - account inactive");
    });

    it("should throw 403 when admin status is pending", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        status: "pending",
      };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(mockAdmin);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });
  });

  describe("Error handling", () => {
    it("should handle API key validation errors gracefully", async () => {
      const mockApiKey = "error-causing-key";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockRejectedValue(
        new Error("Database error"),
      );

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle admin lookup errors gracefully", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle extractApiKey throwing an error", async () => {
      vi.mocked(extractApiKey).mockImplementation(() => {
        throw new Error("Header parsing error");
      });

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should propagate existing ApiErrors without modification", async () => {
      const customError = new ApiError(500, "Custom server error");
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
      vi.mocked(extractApiKey).mockReturnValue("valid-key");
      mockAdminManager.validateApiKey.mockResolvedValue("admin-123");
      mockAdminManager.getAdmin.mockResolvedValue({
        username: "admin",
        status: "active",
      });

      await middleware(minimalReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle admin with undefined status as inactive", async () => {
      const mockApiKey = "valid-admin-api-key";
      const mockAdminId = "admin-123";
      const mockAdmin = {
        username: "admin-user",
        // status is undefined
      };

      vi.mocked(extractApiKey).mockReturnValue(mockApiKey);
      mockAdminManager.validateApiKey.mockResolvedValue(mockAdminId);
      mockAdminManager.getAdmin.mockResolvedValue(mockAdmin);

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
    });

    it("should handle empty string API key", async () => {
      vi.mocked(extractApiKey).mockReturnValue("");

      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });
});
