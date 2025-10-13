import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@recallnet/services/types";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import {
  activeCompMiddleware,
  activeCompResetCache,
} from "@/middleware/active-comp-filter.middleware.js";

vi.mock("@/database/db.js", () => ({
  db: {
    select: vi.fn(),
  },
}));
vi.mock("@/lib/logger.js", () => ({
  middlewareLogger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Active Competition Filter Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockDbSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    activeCompResetCache();

    mockRequest = {
      agentId: "test-agent-id",
    };
    mockResponse = {};
    mockNext = vi.fn();

    mockDbSelect = vi.fn();
    const mockFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: mockDbSelect,
      }),
    });
    vi.mocked(db.select).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof db.select>);
  });

  const id = "comp-123";

  describe("Successful Active Competition", () => {
    it("should set competitionId on request when active competition exists", async () => {
      const mockCompetition = {
        id,
        name: "Test Competition",
      };
      mockDbSelect.mockResolvedValue([mockCompetition]);

      const middleware = activeCompMiddleware();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.competitionId).toBe(id);
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it("should cache positive results and not query database again within TTL", async () => {
      const mockCompetition = {
        id,
        name: "Test Competition",
      };
      mockDbSelect.mockResolvedValue([mockCompetition]);

      const middleware = activeCompMiddleware();

      // First call - should query database
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      expect(mockRequest.competitionId).toBe(id);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it("should query database again after cache expires", async () => {
      const mockCompetition = {
        id,
        name: "Test Competition",
      };
      mockDbSelect.mockResolvedValue([mockCompetition]);

      const middleware = activeCompMiddleware();

      // First call
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) =>
        setTimeout(resolve, config.cache.activeCompetitionTtlMs + 100),
      );

      // Second call after cache expiry - should query database again
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe("No Active Competition", () => {
    it("should return 403 error when no active competition exists", async () => {
      mockDbSelect.mockResolvedValue([]); // No competition found

      const middleware = activeCompMiddleware();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.competitionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));

      const calls = vi.mocked(mockNext).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const error = calls[0]?.[0] as ApiError | undefined;
      expect(error).toBeDefined();
      expect(error).toBeInstanceOf(ApiError);
      expect(error!.statusCode).toBe(403);
      expect(error!.message.toLowerCase()).toContain("no active competition");
    });

    it("should cache negative results to prevent repeated DB queries", async () => {
      mockDbSelect.mockResolvedValue([]); // No competition found

      const middleware = activeCompMiddleware();

      // First call - should query database
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Reset mocks for second call
      const firstCallCount = mockDbSelect.mock.calls.length;
      mockNext = vi.fn();

      // Second call - should use cached negative result (null)
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Should NOT make another DB call - uses cached null
      expect(mockDbSelect).toHaveBeenCalledTimes(firstCallCount);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
    });
  });

  describe("Error Handling", () => {
    it("should propagate database errors through next()", async () => {
      const dbError = new Error("Database connection failed");
      mockDbSelect.mockRejectedValue(dbError);

      const middleware = activeCompMiddleware();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Database timeout");
      mockDbSelect.mockRejectedValue(dbError);

      const middleware = activeCompMiddleware();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe("Request Coalescing", () => {
    it("should handle concurrent requests efficiently with single DB query", async () => {
      const mockCompetition = {
        id,
        name: "Test Competition",
      };

      // Simulate slow database query
      mockDbSelect.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([mockCompetition]), 100),
          ),
      );

      const middleware = activeCompMiddleware();

      // Fire 5 concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        middleware(mockRequest as Request, mockResponse as Response, mockNext),
      );

      await Promise.all(requests);

      // With request coalescing, should only make 1 query
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // All requests should succeed
      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledWith(); // Called without error
    });

    it("should handle concurrent requests during error", async () => {
      const dbError = new Error("Database timeout");

      // Simulate slow failing database query
      mockDbSelect.mockImplementation(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(dbError), 100)),
      );

      const middleware = activeCompMiddleware();

      // Fire 5 concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        middleware(mockRequest as Request, mockResponse as Response, mockNext),
      );

      await Promise.all(requests);

      // With request coalescing, should only make 1 query (all share the failure)
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // All requests should fail
      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });

  describe("Error Backoff (Thundering Herd Prevention)", () => {
    it("should prevent rapid retries after database error", async () => {
      const dbError = new Error("Database connection lost");
      mockDbSelect.mockRejectedValue(dbError);

      const middleware = activeCompMiddleware();

      // First request fails
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(dbError);

      // Immediate subsequent requests should fail fast without querying DB
      mockNext = vi.fn();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Should still be only 1 DB call (backoff prevents second call)
      expect(mockDbSelect).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("rate limited"),
        }),
      );
    });

    it("should allow retries after backoff period expires", async () => {
      const dbError = new Error("Database connection lost");
      mockDbSelect.mockRejectedValue(dbError);

      const middleware = activeCompMiddleware();

      // First request fails
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Wait for backoff period to expire (1000ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Now fix the database
      const mockCompetition = { id, name: "Test Competition" };
      mockDbSelect.mockResolvedValue([mockCompetition]);

      // Should allow retry now
      mockNext = vi.fn();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Should have made a second DB call
      expect(mockDbSelect).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalledWith(); // Success
      expect(mockRequest.competitionId).toBe(id);
    });

    it("should clear error backoff on successful query", async () => {
      const dbError = new Error("Temporary database error");
      const mockCompetition = { id, name: "Test Competition" };

      // Setup mock to fail once, then succeed
      let callCount = 0;
      mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(dbError);
        }
        return Promise.resolve([mockCompetition]);
      });

      const middleware = activeCompMiddleware();

      // First query fails
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(callCount).toBe(1);

      // Wait for backoff to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Second query succeeds
      mockNext = vi.fn();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.competitionId).toBe(id);
      expect(callCount).toBe(2);

      // Third query should use cache (not hit DB)
      mockNext = vi.fn();
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Should still only be 2 DB calls (third uses cache)
      expect(callCount).toBe(2);
      expect(mockRequest.competitionId).toBe(id);
    });
  });

  describe("Cache Reset", () => {
    it("should clear cache and force new database query", async () => {
      const mockCompetition = {
        id,
        name: "Test Competition",
      };
      mockDbSelect.mockResolvedValue([mockCompetition]);

      const middleware = activeCompMiddleware();

      // First call - query database
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Reset cache
      activeCompResetCache();

      // Second call - should query database again
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockDbSelect).toHaveBeenCalledTimes(2);
    });
  });
});
