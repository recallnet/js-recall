import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  EventData,
  EventsRepository,
} from "@recallnet/db/repositories/indexing-events";
import { competitions, users } from "@recallnet/db/schema/core/defs";
import { rewards, rewardsRoots } from "@recallnet/db/schema/rewards/defs";
import { EventProcessor } from "@recallnet/services/indexing";

import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { rewardsRepository, stakesRepository } from "@/lib/repositories";
import { boostAwardService, competitionService } from "@/lib/services";

describe("EventProcessor", () => {
  let eventProcessor: EventProcessor;
  let eventsRepository: EventsRepository;
  let testEvent: EventData;
  let rewardId: string;
  let competitionId: string;
  let rootHashId: string;
  let userId: string;

  beforeEach(async () => {
    // Initialize event processor and repository directly
    eventsRepository = new EventsRepository(db);
    eventProcessor = new EventProcessor(
      db,
      rewardsRepository,
      eventsRepository,
      stakesRepository,
      boostAwardService,
      competitionService,
      createLogger("EventProcessor"),
    );

    // Set up test data in the database
    competitionId = "a82d8ae0-6f5a-417c-a35e-e389b73f0b39";
    rewardId = "dcff1f5d-ebee-49b0-905d-9d1e8eb9767c";
    rootHashId = "d9573309-9785-44ad-8ac6-4d912a5be43c";
    userId = "f1234567-89ab-cdef-0123-456789abcdef";

    // First create a user
    await db.insert(users).values({
      id: userId,
      walletAddress: "0x00a826b7a0c21c7f3c7156c4e1aa197a111b8233",
      name: "Test User",
      email: "test@example.com",
      isSubscribed: false,
      status: "active",
    });

    // Then create a competition
    await db.insert(competitions).values({
      id: competitionId,
      name: "Test Competition",
      description: "Test competition for reward claiming",
      status: "active",
      sandboxMode: false,
      registeredParticipants: 0,
    });

    // Insert the rewards root hash entry
    await db.insert(rewardsRoots).values({
      id: rootHashId,
      competitionId: competitionId,
      rootHash: new Uint8Array([
        243, 59, 77, 218, 129, 49, 183, 243, 125, 73, 158, 154, 233, 72, 214,
        180, 105, 165, 34, 110, 58, 171, 249, 79, 9, 154, 162, 125, 52, 159,
        198, 162,
      ]), // 0xf33b4dda8131b7f37d499e9ae948d6b469a5226e3aabf94f099aa27d349fc6a2
      tx: "0x8780a9c16fb00c395fb6fa69ddfed0ddef5829c0867dca92b1a8849c763ee945",
      createdAt: new Date("2025-09-12T14:43:43.055519Z"),
    });

    // Insert the reward entry
    await db.insert(rewards).values({
      id: rewardId,
      competitionId: competitionId,
      userId: userId,
      address: "0x00a826b7a0c21c7f3c7156c4e1aa197a111b8233",
      walletAddress: "0x00a826b7a0c21c7f3c7156c4e1aa197a111b8233",
      amount: BigInt("100000000000000000"),
      leafHash: new Uint8Array(), // it does not matter for the test
      claimed: false,
      createdAt: new Date("2025-09-12T14:43:16.067058Z"),
      updatedAt: new Date("2025-09-12T19:39:33.812Z"),
    });

    // Create the test event data
    testEvent = {
      blockNumber: 30959979n,
      blockHash:
        "0xc8d07466306f420533f44678792eff7d11b1ffd7aaa1689aa5594a623dca6300",
      blockTimestamp: new Date("2025-09-12T14:44:06.000Z"),
      transactionHash:
        "0xb101d1b5887bf59d3fb70e9ae4f66d5cadd9b6b1232bc1d49f2622cea9a014ec",
      logIndex: 2,
      raw: {
        topics: [
          "0xfe236dfc7ce073698734b89da1aee0e7551c9c6d264404c502e6e8fefc1132a8",
          "0xf33b4dda8131b7f37d499e9ae948d6b469a5226e3aabf94f099aa27d349fc6a2",
          "0x00000000000000000000000000a826b7a0c21c7f3c7156c4e1aa197a111b8233",
        ],
        data: "0x000000000000000000000000000000000000000000000000016345785d8a0000",
        address: "0x08eb26382777b344e21d0ebe92bb4b32a5ff63b6",
      },
      type: "rewardClaimed" as const,
      createdAt: new Date("2025-09-12T19:39:33.806Z"),
    };
  });

  test("processRewardClaimedEvent should mark reward as claimed", async () => {
    // Verify the reward is initially marked as claimed
    const initialReward = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, rewardId))
      .limit(1);

    expect(initialReward[0]).toBeDefined();
    expect(initialReward[0]!.claimed).toBe(false);

    // Process the event
    await eventProcessor.processEvent(testEvent as EventData, "RewardClaimed");

    // Verify the reward is marked as claimed after processing the event
    const finalReward = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, rewardId))
      .limit(1);

    expect(finalReward[0]).toBeDefined();
    expect(finalReward[0]!.claimed).toBe(true);
    expect(finalReward[0]!.updatedAt).toBeDefined();

    // Verify the event was recorded in the indexing_events table
    const recordedEvent = await eventsRepository.isEventPresent(
      testEvent.blockNumber,
      testEvent.transactionHash,
      testEvent.logIndex,
    );
    expect(recordedEvent).toBe(true);
  });

  test("processRewardClaimedEvent should handle unknown roothash gracefully", async () => {
    // Create an event with a different roothash that doesn't exist in the database
    const unknownRootHashEvent: EventData = {
      ...testEvent,
      raw: {
        ...testEvent.raw,
        topics: [
          "0xfe236dfc7ce073698734b89da1aee0e7551c9c6d264404c502e6e8fefc1132a8",
          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // Different roothash
          "0x00000000000000000000000000a826b7a0c21c7f3c7156c4e1aa197a111b8233",
        ],
      },
    };

    // Verify the reward is initially not claimed
    const initialReward = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, rewardId))
      .limit(1);

    expect(initialReward[0]).toBeDefined();
    expect(initialReward[0]!.claimed).toBe(false);

    // Process the event with unknown roothash - should not throw an exception
    await expect(
      eventProcessor.processEvent(
        unknownRootHashEvent as EventData,
        "RewardClaimed",
      ),
    ).resolves.not.toThrow();

    // Verify the reward is still not claimed (no competition found for unknown roothash)
    const finalReward = await db
      .select()
      .from(rewards)
      .where(eq(rewards.id, rewardId))
      .limit(1);

    expect(finalReward[0]).toBeDefined();
    expect(finalReward[0]!.claimed).toBe(false); // Should remain false

    // Verify the event was still recorded in the indexing_events table
    const recordedEvent = await eventsRepository.isEventPresent(
      unknownRootHashEvent.blockNumber,
      unknownRootHashEvent.transactionHash,
      unknownRootHashEvent.logIndex,
    );
    expect(recordedEvent).toBe(true);
  });
});
