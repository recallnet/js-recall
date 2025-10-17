import { randomUUID } from "crypto";
import { pino } from "pino";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { agents } from "../../schema/core/defs.js";
import { competitionAgents, competitions } from "../../schema/core/defs.js";
import { users } from "../../schema/core/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { AgentRepository } from "../agent.js";
import { CompetitionRewardsRepository } from "../competition-rewards.js";
import { CompetitionRepository } from "../competition.js";
import { UserRepository } from "../user.js";
import { db } from "./db.js";

describe("CompetitionRepository - One Agent Per User Integration", () => {
  let competitionRepo: CompetitionRepository;
  let agentRepo: AgentRepository;
  let userRepo: UserRepository;
  let competitionRewardsRepo: CompetitionRewardsRepository;
  let logger: ReturnType<typeof pino>;

  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  beforeEach(async () => {
    // Create logger
    logger = pino({ level: "silent" }); // Silent logger for tests

    // Create repository instances with real DB
    // Type assertion needed due to pino Logger generic type mismatch
    competitionRewardsRepo = new CompetitionRewardsRepository(
      db,
      logger as never,
    );
    competitionRepo = new CompetitionRepository(db, db, logger as never);
    agentRepo = new AgentRepository(
      db,
      logger as never,
      competitionRewardsRepo,
    );
    userRepo = new UserRepository(db, logger as never);
  });

  afterEach(async () => {
    // Clean up test data in reverse dependency order
    await db.delete(competitionAgents);
    await db.delete(competitions);
    await db.delete(agents);
    await db.delete(users);
  });

  test("should allow user to register first agent successfully", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Test User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Create agent
    const agent = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Test Agent",
      handle: `ag-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key-${Date.now()}`,
      apiKeyHash: `hash-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Test Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // First agent should register successfully
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent.id),
    ).resolves.toBeUndefined();

    // Verify agent was added
    const isActive = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent.id,
    );
    expect(isActive).toBe(true);
  });

  test("should prevent user from registering second agent (transaction test)", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Test User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Create two agents for same user
    const agent1 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Test Agent 1",
      handle: `ag1-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key1-${Date.now()}`,
      apiKeyHash: `hash1-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    const agent2 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "3")}`,
      name: "Test Agent 2",
      handle: `ag2-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `key2-${Date.now()}`,
      apiKeyHash: `hash2-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Test Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // First agent registers successfully
    await competitionRepo.addAgentToCompetition(competition.id, agent1.id);

    // Second agent should fail with one-agent-per-user error
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent2.id),
    ).rejects.toThrow(
      "User already has an agent registered in this competition",
    );

    // Verify only first agent was added
    const isAgent1Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent1.id,
    );
    const isAgent2Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent2.id,
    );

    expect(isAgent1Active).toBe(true);
    expect(isAgent2Active).toBe(false);
  });

  test("should handle race condition with concurrent registration attempts", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Race Test User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Create two agents for same user
    const agent1 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Race Agent 1",
      handle: `r1-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `race-key1-${Date.now()}`,
      apiKeyHash: `race-hash1-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    const agent2 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "3")}`,
      name: "Race Agent 2",
      handle: `r2-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `race-key2-${Date.now()}`,
      apiKeyHash: `race-hash2-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Race Test Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // Attempt to register both agents simultaneously
    const results = await Promise.allSettled([
      competitionRepo.addAgentToCompetition(competition.id, agent1.id),
      competitionRepo.addAgentToCompetition(competition.id, agent2.id),
    ]);

    // One should succeed, one should fail
    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // The failure should have the correct error message
    const failure = failures[0] as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(Error);
    expect((failure.reason as Error).message).toContain(
      "User already has an agent registered in this competition",
    );

    // Verify exactly one agent was added
    const isAgent1Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent1.id,
    );
    const isAgent2Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent2.id,
    );

    // Exactly one should be active
    expect(isAgent1Active || isAgent2Active).toBe(true);
    expect(isAgent1Active && isAgent2Active).toBe(false);
  });

  test("should prevent deactivate/reactivate loophole", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user with two agents
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Loophole Test User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const agent1 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Loophole Agent 1",
      handle: `l1-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `loop-key1-${Date.now()}`,
      apiKeyHash: `loop-hash1-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    const agent2 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "3")}`,
      name: "Loophole Agent 2",
      handle: `l2-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `loop-key2-${Date.now()}`,
      apiKeyHash: `loop-hash2-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Loophole Test Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // Register first agent
    await competitionRepo.addAgentToCompetition(competition.id, agent1.id);

    // Deactivate first agent
    await competitionRepo.updateAgentCompetitionStatus(
      competition.id,
      agent1.id,
      "withdrawn",
      "Testing deactivation",
    );

    // Attempt to register second agent should still fail
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent2.id),
    ).rejects.toThrow(
      "User already has an agent registered in this competition",
    );

    // Verify agent2 was NOT added
    const isAgent2Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent2.id,
    );
    expect(isAgent2Active).toBe(false);
  });

  test("should allow different users to each register their own agent", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create two users
    const user1 = await userRepo.create({
      id: randomUUID(),
      privyId: `p1-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "User 1",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const user2 = await userRepo.create({
      id: randomUUID(),
      privyId: `p2-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "3")}`,
      name: "User 2",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Create one agent per user
    const agent1 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user1.id,
      walletAddress: `0x${testId.padEnd(40, "4")}`,
      name: "User1 Agent",
      handle: `u1-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `user1-key-${Date.now()}`,
      apiKeyHash: `user1-hash-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    const agent2 = await agentRepo.create({
      id: randomUUID(),
      ownerId: user2.id,
      walletAddress: `0x${testId.padEnd(40, "5")}`,
      name: "User2 Agent",
      handle: `u2-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `user2-key-${Date.now()}`,
      apiKeyHash: `user2-hash-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Multi User Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // Both users can register their agents
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent1.id),
    ).resolves.toBeUndefined();

    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent2.id),
    ).resolves.toBeUndefined();

    // Verify both are active
    const isAgent1Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent1.id,
    );
    const isAgent2Active = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent2.id,
    );

    expect(isAgent1Active).toBe(true);
    expect(isAgent2Active).toBe(true);
  });

  test("should allow re-adding same agent (idempotent)", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user and agent
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Idempotent Test User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const agent = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Idempotent Agent",
      handle: `id-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `idem-key-${Date.now()}`,
      apiKeyHash: `idem-hash-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create competition
    const competition = await competitionRepo.create({
      id: randomUUID(),
      name: "Idempotent Test Competition",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // Add agent first time
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent.id),
    ).resolves.toBeUndefined();

    // Re-adding same agent should succeed (idempotent)
    await expect(
      competitionRepo.addAgentToCompetition(competition.id, agent.id),
    ).resolves.toBeUndefined();

    // Verify agent is still active
    const isActive = await competitionRepo.isAgentActiveInCompetition(
      competition.id,
      agent.id,
    );
    expect(isActive).toBe(true);
  });

  test("should allow same agent to join multiple competitions", async () => {
    const testId = randomUUID().substring(0, 8);

    // Create user and agent
    const user = await userRepo.create({
      id: randomUUID(),
      privyId: `privy-${testId}`,
      walletAddress: `0x${testId.padEnd(40, "0")}`,
      embeddedWalletAddress: `0x${testId.padEnd(40, "1")}`,
      name: "Multi Comp User",
      email: null,
      status: "active",
      metadata: null,
      walletLastVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const agent = await agentRepo.create({
      id: randomUUID(),
      ownerId: user.id,
      walletAddress: `0x${testId.padEnd(40, "2")}`,
      name: "Multi Comp Agent",
      handle: `mc-${testId}`,
      email: null,
      description: null,
      imageUrl: null,
      apiKey: `multi-key-${Date.now()}`,
      apiKeyHash: `multi-hash-${Date.now()}`,
      metadata: null,
      status: "active",
    });

    // Create two competitions
    const comp1 = await competitionRepo.create({
      id: randomUUID(),
      name: "Competition 1",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    const comp2 = await competitionRepo.create({
      id: randomUUID(),
      name: "Competition 2",
      description: "Test",
      type: "trading",
      status: "pending",
      startDate: new Date(),
      endDate: new Date(),
      imageUrl: null,
      externalUrl: null,
      boostStartDate: null,
      boostEndDate: null,
      joinStartDate: null,
      joinEndDate: null,
      maxParticipants: null,
      registeredParticipants: 0,
      sandboxMode: false,
    });

    // Same agent can join both competitions
    await expect(
      competitionRepo.addAgentToCompetition(comp1.id, agent.id),
    ).resolves.toBeUndefined();

    await expect(
      competitionRepo.addAgentToCompetition(comp2.id, agent.id),
    ).resolves.toBeUndefined();

    // Verify agent is in both competitions
    const isInComp1 = await competitionRepo.isAgentActiveInCompetition(
      comp1.id,
      agent.id,
    );
    const isInComp2 = await competitionRepo.isAgentActiveInCompetition(
      comp2.id,
      agent.id,
    );

    expect(isInComp1).toBe(true);
    expect(isInComp2).toBe(true);
  });
});
