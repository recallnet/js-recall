import { describe, expect, it } from "vitest";

import { AdminSearchUsersAndAgentsQuerySchema } from "../main.js";

describe("AdminSearchUsersAndAgentsQuerySchema", () => {
  it("should throw error if no search parameters provided", () => {
    expect(() => AdminSearchUsersAndAgentsQuerySchema.parse({})).toThrow();
  });

  it("should parse user search parameters", () => {
    const result = AdminSearchUsersAndAgentsQuerySchema.parse({
      "user.email": "test@example.com",
    });
    expect(result).toMatchObject({
      user: { email: "test@example.com" },
    });
  });

  it("should parse agent search parameters", () => {
    const result = AdminSearchUsersAndAgentsQuerySchema.parse({
      "agent.name": "TestAgent",
    });
    expect(result).toMatchObject({
      agent: { name: "TestAgent" },
    });
  });

  it("should parse both user and agent parameters", () => {
    const result = AdminSearchUsersAndAgentsQuerySchema.parse({
      "user.email": "test@example.com",
      "agent.name": "TestAgent",
    });
    expect(result).toMatchObject({
      user: { email: "test@example.com" },
      agent: { name: "TestAgent" },
    });
  });
});
