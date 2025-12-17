import { randomUUID } from "crypto";
import { Request } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkUniqueConstraintViolation,
  checkUserUniqueConstraintViolation,
} from "@recallnet/services/lib";

import { config } from "@/config/index.js";
import { AuthenticatedRequest } from "@/types/index.js";

import {
  checkIsAdmin,
  checkIsCacheEnabled,
  checkIsPublicOrUserRequest,
  checkShouldCacheResponse,
  generateCacheKey,
} from "../request-helpers.js";
import {
  buildPaginationResponse,
  ensureAgentCompetitionParams,
  ensureAgentId,
  ensureCompetitionUpdate,
  ensurePaging,
  ensureUserId,
  ensureUuid,
  parseAdminSearchQuery,
} from "../request-helpers.js";

describe("Request Helpers", () => {
  describe("ensureUserId", () => {
    it("should throw an error if the user ID is not provided", () => {
      const req = {} as Request;
      expect(() => ensureUserId(req)).toThrow(
        "Invalid authentication: user ID is required",
      );
    });

    it("should return the user ID if it is provided", () => {
      const userId = randomUUID();
      const req = { userId } as AuthenticatedRequest;
      expect(ensureUserId(req)).toBe(userId);
    });
  });

  describe("ensureAgentId", () => {
    it("should throw an error if the agent ID is not provided", () => {
      const req = {} as Request;
      expect(() => ensureAgentId(req)).toThrow(
        "Invalid authentication: agent ID is required",
      );
    });

    it("should return the agent ID if it is provided", () => {
      const agentId = randomUUID();
      const req = { agentId } as AuthenticatedRequest;
      expect(ensureAgentId(req)).toBe(agentId);
    });
  });

  describe("ensureUuid", () => {
    it("should throw an error if the UUID is not provided", () => {
      expect(() => ensureUuid(undefined)).toThrow("Invalid UUID");
    });

    it("should return the UUID if it is provided", () => {
      const uuid = randomUUID();
      expect(ensureUuid(uuid)).toBe(uuid);
    });
  });

  describe("ensurePaging", () => {
    it("should throw an error if the paging is not provided", () => {
      const req = {} as AuthenticatedRequest;
      expect(() => ensurePaging(req)).toThrow("Invalid pagination parameters");
    });

    it("should return the paging if it is provided", () => {
      const req = {
        query: { sort: "", limit: 10, offset: 0 },
      } as unknown as Request;
      expect(ensurePaging(req)).toEqual(req.query);
    });
  });

  describe("ensureAgentCompetitionParams", () => {
    it("should return default values for empty query", () => {
      const req = { query: {} } as Request;
      const result = ensureAgentCompetitionParams(req);
      expect(result).toMatchObject({
        sort: "",
        limit: 10,
        offset: 0,
      });
    });

    it("should return the filters if they are valid", () => {
      const req = {
        query: { status: "active", sort: "name", limit: 20, offset: 10 },
      } as unknown as Request;
      const result = ensureAgentCompetitionParams(req);
      expect(result).toMatchObject({
        status: "active",
        sort: "name",
        limit: 20,
        offset: 10,
      });
    });

    it("should throw an error for invalid status", () => {
      const req = {
        query: { status: "invalid_status", sort: "", limit: 10, offset: 0 },
      } as unknown as Request;
      expect(() => ensureAgentCompetitionParams(req)).toThrow(
        "Invalid filter and paging params",
      );
    });
  });

  describe("ensureCompetitionUpdate", () => {
    it("should accept empty body for competition update", () => {
      // UpdateCompetitionSchema from drizzle makes all fields optional
      const req = { body: {} } as Request;
      const result = ensureCompetitionUpdate(req);
      expect(result).toEqual({});
    });

    it("should throw an error if forbidden fields are included", () => {
      const req = {
        body: {
          id: randomUUID(), // This is a forbidden field for updates
          name: "Updated Competition",
          description: "Updated description",
        },
      } as Request;
      expect(() => ensureCompetitionUpdate(req)).toThrow(
        "Invalid competition update, attempting to update forbidden field",
      );
    });

    it("should throw an error for fields that exist in the table but not in allowed update schema", () => {
      const req = {
        body: {
          registeredParticipants: 100, // This exists in the table but not in CompetitionAllowedUpdateSchema
          name: "Updated Competition",
        },
      } as Request;
      expect(() => ensureCompetitionUpdate(req)).toThrow(
        "Invalid competition update, attempting to update forbidden field",
      );
    });

    it("should return the update if it contains only allowed fields", () => {
      const validUpdate = {
        name: "Updated Competition",
        description: "Updated description",
      };
      const req = { body: validUpdate } as Request;
      const result = ensureCompetitionUpdate(req);
      expect(result).toMatchObject(validUpdate);
    });

    it("should accept rewards in the update", () => {
      const updateWithRewards = {
        name: "Competition with rewards",
        rewards: {
          "1": 1000,
          "2": 500,
          "3": 250,
        },
      };
      const req = { body: updateWithRewards } as Request;
      const result = ensureCompetitionUpdate(req);
      expect(result.name).toBe(updateWithRewards.name);
    });
  });

  describe("checkIsAdmin", () => {
    it("should return false if isAdmin is not set", () => {
      const req = {} as AuthenticatedRequest;
      expect(checkIsAdmin(req)).toBe(false);
    });

    it("should return false if isAdmin is false", () => {
      const req = { isAdmin: false } as AuthenticatedRequest;
      expect(checkIsAdmin(req)).toBe(false);
    });

    it("should return true if isAdmin is true", () => {
      const req = { isAdmin: true } as AuthenticatedRequest;
      expect(checkIsAdmin(req)).toBe(true);
    });
  });

  describe("buildPaginationResponse", () => {
    it("should build correct pagination response", () => {
      expect(buildPaginationResponse(100, 10, 0)).toEqual({
        total: 100,
        limit: 10,
        offset: 0,
        hasMore: true,
      });

      expect(buildPaginationResponse(100, 10, 90)).toEqual({
        total: 100,
        limit: 10,
        offset: 90,
        hasMore: false,
      });

      expect(buildPaginationResponse(100, 10, 100)).toEqual({
        total: 100,
        limit: 10,
        offset: 100,
        hasMore: false,
      });

      expect(buildPaginationResponse(100, 10, 85)).toEqual({
        total: 100,
        limit: 10,
        offset: 85,
        hasMore: true,
      });
    });
  });

  describe("parseAdminSearchQuery", () => {
    it("should throw error if no search parameters provided", () => {
      expect(() => parseAdminSearchQuery("https://example.com/search")).toThrow(
        "Invalid request format: must provide user or agent search parameters",
      );
    });

    it("should parse user search parameters", () => {
      const result = parseAdminSearchQuery(
        "https://example.com/search?user.email=test@example.com",
      );
      expect(result).toMatchObject({
        user: { email: "test@example.com" },
      });
    });

    it("should parse agent search parameters", () => {
      const result = parseAdminSearchQuery(
        "https://example.com/search?agent.name=TestAgent",
      );
      expect(result).toMatchObject({
        agent: { name: "TestAgent" },
      });
    });

    it("should parse both user and agent parameters", () => {
      const result = parseAdminSearchQuery(
        "https://example.com/search?user.email=test@example.com&agent.name=TestAgent",
      );
      expect(result).toMatchObject({
        user: { email: "test@example.com" },
        agent: { name: "TestAgent" },
      });
    });
  });

  describe("checkUniqueConstraintViolation", () => {
    it("should return undefined for non-constraint errors", () => {
      expect(checkUniqueConstraintViolation(new Error("Some error"))).toBe(
        undefined,
      );
      expect(checkUniqueConstraintViolation({ code: "23506" })).toBe(undefined);
    });

    it("should return constraint name for unique violations", () => {
      const error = {
        code: "23505",
        constraint: "users_email_unique",
      };
      expect(checkUniqueConstraintViolation(error)).toBe("users_email_unique");
    });
  });

  describe("checkUserUniqueConstraintViolation", () => {
    it("should return undefined for non-constraint errors", () => {
      expect(checkUserUniqueConstraintViolation(new Error("Some error"))).toBe(
        undefined,
      );
    });

    it("should return walletAddress for wallet constraints", () => {
      const error = {
        code: "23505",
        constraint: "users_wallet_address_unique",
      };
      expect(checkUserUniqueConstraintViolation(error)).toBe("walletAddress");
    });

    it("should return email for email constraints", () => {
      const error = {
        code: "23505",
        constraint: "users_email_unique",
      };
      expect(checkUserUniqueConstraintViolation(error)).toBe("email");
    });

    it("should return privyId for privy constraints", () => {
      const error = {
        code: "23505",
        constraint: "users_privy_id_unique",
      };
      expect(checkUserUniqueConstraintViolation(error)).toBe("privyId");
    });

    it("should return unique value for other constraints", () => {
      const error = {
        code: "23505",
        constraint: "some_other_unique",
      };
      expect(checkUserUniqueConstraintViolation(error)).toBe("unique value");
    });
  });

  describe("checkIsPublicOrUserRequest", () => {
    it("should return true for unauthenticated requests", () => {
      const req = {} as AuthenticatedRequest;
      expect(checkIsPublicOrUserRequest(req)).toBe(true);
    });

    it("should return true for user authenticated requests", () => {
      const req = { userId: randomUUID() } as AuthenticatedRequest;
      expect(checkIsPublicOrUserRequest(req)).toBe(true);
    });

    it("should return false for agent requests", () => {
      const req = { agentId: randomUUID() } as AuthenticatedRequest;
      expect(checkIsPublicOrUserRequest(req)).toBe(false);
    });

    it("should return false for admin requests", () => {
      const req = { isAdmin: true } as AuthenticatedRequest;
      expect(checkIsPublicOrUserRequest(req)).toBe(false);
    });

    it("should return false for agent admin requests", () => {
      const req = {
        agentId: randomUUID(),
        isAdmin: true,
      } as AuthenticatedRequest;
      expect(checkIsPublicOrUserRequest(req)).toBe(false);
    });
  });

  describe("checkIsCacheEnabled", () => {
    const originalDisableCaching = config.cache.api.disableCaching;

    afterEach(() => {
      config.cache.api.disableCaching = originalDisableCaching;
    });

    it("should return true when caching is enabled", () => {
      config.cache.api.disableCaching = false;
      expect(checkIsCacheEnabled()).toBe(true);
    });

    it("should return false when caching is disabled", () => {
      config.cache.api.disableCaching = true;
      expect(checkIsCacheEnabled()).toBe(false);
    });
  });

  describe("checkShouldCacheResponse", () => {
    const originalDisableCaching = config.cache.api.disableCaching;

    beforeEach(() => {
      config.cache.api.disableCaching = false;
    });

    afterEach(() => {
      config.cache.api.disableCaching = originalDisableCaching;
    });

    it("should return false when caching is disabled", () => {
      config.cache.api.disableCaching = true;
      const req = {} as Request;
      expect(checkShouldCacheResponse(req)).toBe(false);
    });

    it("should return true for public requests when caching is enabled", () => {
      const req = {} as Request;
      expect(checkShouldCacheResponse(req)).toBe(true);
    });

    it("should return true for user requests when caching is enabled", () => {
      const req = { userId: randomUUID() } as AuthenticatedRequest;
      expect(checkShouldCacheResponse(req)).toBe(true);
    });

    it("should return false for agent requests", () => {
      const req = { agentId: randomUUID() } as AuthenticatedRequest;
      expect(checkShouldCacheResponse(req)).toBe(false);
    });

    it("should return false for admin requests", () => {
      const req = { isAdmin: true } as AuthenticatedRequest;
      expect(checkShouldCacheResponse(req)).toBe(false);
    });
  });

  describe("generateCacheKey", () => {
    it("should generate anon cache key for unauthenticated requests", () => {
      const req = {} as AuthenticatedRequest;
      expect(generateCacheKey(req, "testCache")).toBe("testCache:anon");
    });

    it("should generate user cache key for authenticated users", () => {
      const userId = randomUUID();
      const req = { userId } as AuthenticatedRequest;
      expect(generateCacheKey(req, "testCache")).toBe("testCache:user");
    });

    it("should include params in cache key for anon users", () => {
      const req = {} as AuthenticatedRequest;
      const params = { competitionId: "123", status: "active" };
      expect(generateCacheKey(req, "testCache", params)).toBe(
        `testCache:anon:${JSON.stringify(params)}`,
      );
    });

    it("should include params in cache key for authenticated users", () => {
      const userId = randomUUID();
      const req = { userId } as AuthenticatedRequest;
      const params = { competitionId: "123", status: "active" };
      expect(generateCacheKey(req, "testCache", params)).toBe(
        `testCache:user:${JSON.stringify(params)}`,
      );
    });

    it("should generate different cache keys when userId is included in params", () => {
      const userId1 = randomUUID();
      const userId2 = randomUUID();
      const req1 = { userId: userId1 } as AuthenticatedRequest;
      const req2 = { userId: userId2 } as AuthenticatedRequest;
      const params1 = { competitionId: "123", userId: userId1 };
      const params2 = { competitionId: "123", userId: userId2 };

      const key1 = generateCacheKey(req1, "testCache", params1);
      const key2 = generateCacheKey(req2, "testCache", params2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe(`testCache:user:${JSON.stringify(params1)}`);
      expect(key2).toBe(`testCache:user:${JSON.stringify(params2)}`);
    });

    it("should generate same cache key when userId is not in params", () => {
      const userId1 = randomUUID();
      const userId2 = randomUUID();
      const req1 = { userId: userId1 } as AuthenticatedRequest;
      const req2 = { userId: userId2 } as AuthenticatedRequest;
      const params = { competitionId: "123" };

      const key1 = generateCacheKey(req1, "testCache", params);
      const key2 = generateCacheKey(req2, "testCache", params);

      expect(key1).toBe(key2);
      expect(key1).toBe(`testCache:user:${JSON.stringify(params)}`);
    });
  });
});
