import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { ApiError } from "@recallnet/services/types";

import { flatParse } from "../flat-parse.js";

describe("flatParse", () => {
  describe("successful validation", () => {
    it("should return validated data for valid string input", () => {
      const schema = z.string();
      const input = "test string";
      const result = flatParse(schema, input);
      expect(result).toBe(input);
    });

    it("should return validated data for valid number input", () => {
      const schema = z.number();
      const input = 42;
      const result = flatParse(schema, input);
      expect(result).toBe(input);
    });

    it("should return validated data for valid object input", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const input = { name: "John", age: 30 };
      const result = flatParse(schema, input);
      expect(result).toEqual(input);
    });

    it("should return validated data for valid array input", () => {
      const schema = z.array(z.string());
      const input = ["a", "b", "c"];
      const result = flatParse(schema, input);
      expect(result).toEqual(input);
    });

    it("should return validated data with transformed values", () => {
      const schema = z.object({
        limit: z.coerce.number(),
        offset: z.coerce.number(),
      });
      const input = { limit: "10", offset: "20" };
      const result = flatParse(schema, input);
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it("should return validated data for complex nested object", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.email(),
        }),
        metadata: z.record(z.string(), z.string()),
      });
      const input = {
        user: { name: "Jane", email: "jane@example.com" },
        metadata: { key1: "value1", key2: "value2" },
      };
      const result = flatParse(schema, input);
      expect(result).toEqual(input);
    });
  });

  describe("validation failures without requestPart", () => {
    it("should throw ApiError for invalid string input", () => {
      const schema = z.string();
      const input = 123;
      expect(() => flatParse(schema, input)).toThrow(ApiError);
      expect(() => flatParse(schema, input)).toThrow(
        "Invalid request: expected string, received number",
      );
    });

    it("should throw ApiError with 400 status code", () => {
      const schema = z.string();
      const input = 123;
      try {
        flatParse(schema, input);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(400);
      }
    });

    it("should throw ApiError for missing required fields", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const input = { name: "John" };
      expect(() => flatParse(schema, input)).toThrow(ApiError);
      expect(() => flatParse(schema, input)).toThrow(
        "Invalid request: age (expected number, received undefined)",
      );
    });

    it("should throw ApiError for invalid email format", () => {
      const schema = z.object({
        email: z.email(),
      });
      const input = { email: "not-an-email" };
      expect(() => flatParse(schema, input)).toThrow(ApiError);
      expect(() => flatParse(schema, input)).toThrow(
        "Invalid request: email (invalid email address)",
      );
    });

    it("should concatenate multiple validation errors", () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().min(0).max(150),
        email: z.email(),
      });
      const input = { name: "Jo", age: 200, email: "invalid" };
      expect(() => flatParse(schema, input)).toThrow(ApiError);
      const error = (() => {
        try {
          flatParse(schema, input);
        } catch (e) {
          return e as ApiError;
        }
      })();
      expect(error?.message).toContain("name (");
      expect(error?.message).toContain("age (");
      expect(error?.message).toContain("email (");
      expect(error?.message).toContain("too small");
      expect(error?.message).toContain("too big");
      expect(error?.message).toContain("invalid email");
      expect(error?.message.split("; ").length).toBeGreaterThanOrEqual(3);
    });

    it("should throw ApiError for invalid array element types", () => {
      const schema = z.array(z.number());
      const input = [1, 2, "three", 4];
      expect(() => flatParse(schema, input)).toThrow(ApiError);
      expect(() => flatParse(schema, input)).toThrow(
        "Invalid request: 2 (expected number, received string)",
      );
    });
  });

  describe("validation failures with requestPart", () => {
    it("should include requestPart in error message for body validation", () => {
      const schema = z.object({
        name: z.string(),
      });
      const input = { name: 123 };
      expect(() => flatParse(schema, input, "body")).toThrow(ApiError);
      expect(() => flatParse(schema, input, "body")).toThrow(
        "Invalid request body: name (expected string, received number)",
      );
    });

    it("should include requestPart in error message for params validation", () => {
      const schema = z.object({
        id: z.string().uuid(),
      });
      const input = { id: "not-a-uuid" };
      expect(() => flatParse(schema, input, "params")).toThrow(ApiError);
      expect(() => flatParse(schema, input, "params")).toThrow(
        "Invalid request params: id (invalid UUID)",
      );
    });

    it("should include requestPart in error message for query validation", () => {
      const schema = z.object({
        limit: z.number(),
      });
      const input = { limit: "invalid" };
      expect(() => flatParse(schema, input, "query")).toThrow(ApiError);
      expect(() => flatParse(schema, input, "query")).toThrow(
        "Invalid request query:",
      );
    });

    it("should concatenate multiple errors with requestPart", () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().positive(),
      });
      const input = { email: "invalid", age: -5 };
      expect(() => flatParse(schema, input, "body")).toThrow(ApiError);
      const error = (() => {
        try {
          flatParse(schema, input, "body");
        } catch (e) {
          return e as ApiError;
        }
      })();
      expect(error?.message).toContain("Invalid request body:");
      expect(error?.message).toContain("email (");
      expect(error?.message).toContain("age (");
      expect(error?.message).toContain("invalid email");
      expect(error?.message).toContain("too small");
    });
  });

  describe("edge cases", () => {
    it("should handle null input", () => {
      const schema = z.string();
      expect(() => flatParse(schema, null)).toThrow(ApiError);
      expect(() => flatParse(schema, null)).toThrow(
        "Invalid request: expected string, received null",
      );
    });

    it("should handle undefined input", () => {
      const schema = z.string();
      expect(() => flatParse(schema, undefined)).toThrow(ApiError);
      expect(() => flatParse(schema, undefined)).toThrow(
        "Invalid request: expected string, received undefined",
      );
    });

    it("should handle optional fields correctly", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const input = { name: "John" };
      const result = flatParse(schema, input);
      expect(result).toEqual({ name: "John" });
    });

    it("should handle default values correctly", () => {
      const schema = z.object({
        name: z.string(),
        status: z.string().default("active"),
      });
      const input = { name: "John" };
      const result = flatParse(schema, input);
      expect(result).toEqual({ name: "John", status: "active" });
    });

    it("should handle discriminated unions", () => {
      const schema = z.discriminatedUnion("type", [
        z.object({ type: z.literal("user"), userId: z.string() }),
        z.object({ type: z.literal("agent"), agentId: z.string() }),
      ]);
      const validInput = { type: "user" as const, userId: "123" };
      const result = flatParse(schema, validInput);
      expect(result).toEqual(validInput);

      const invalidInput = { type: "user" as const, agentId: "123" };
      expect(() => flatParse(schema, invalidInput)).toThrow(ApiError);
    });

    it("should preserve type information for validated data", () => {
      const schema = z.object({
        id: z.string(),
        count: z.number(),
        active: z.boolean(),
      });
      const input = { id: "123", count: 42, active: true };
      const result = flatParse(schema, input);

      // Type assertion to verify TypeScript types are correct
      const id: string = result.id;
      const count: number = result.count;
      const active: boolean = result.active;

      expect(id).toBe("123");
      expect(count).toBe(42);
      expect(active).toBe(true);
    });

    it("should handle custom refinements", () => {
      const schema = z
        .object({
          password: z.string(),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords do not match",
        });

      const validInput = {
        password: "secret123",
        confirmPassword: "secret123",
      };
      const result = flatParse(schema, validInput);
      expect(result).toEqual(validInput);

      const invalidInput = {
        password: "secret123",
        confirmPassword: "different",
      };
      expect(() => flatParse(schema, invalidInput)).toThrow(ApiError);
      expect(() => flatParse(schema, invalidInput)).toThrow(
        "Invalid request: passwords do not match",
      );
    });
  });
});
