import { describe, expect, it } from "vitest";

import { calculateRewards } from "./index.js";
import type {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
} from "./types.js";

describe("calculateRewards", () => {
  it("should calculate rewards correctly for 1000 ETH prize pool with 3 users and 3 competitors over 4-day window", () => {
    // Test parameters from testcase.md
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      "Competitor A",
      "Competitor B",
      "Competitor C",
    ];
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    // Boost allocations from testcase.md
    const boostAllocations: BoostAllocation[] = [
      // Alice's allocations
      {
        user: "Alice",
        competitor: "Competitor A",
        boost: 100,
        timestamp: new Date("2024-01-01T12:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user: "Alice",
        competitor: "Competitor B",
        boost: 50,
        timestamp: new Date("2024-01-02T18:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user: "Alice",
        competitor: "Competitor C",
        boost: 75,
        timestamp: new Date("2024-01-03T09:00:00Z"), // Day 3: decay factor 0.25
      },

      // Bob's allocations
      {
        user: "Bob",
        competitor: "Competitor A",
        boost: 80,
        timestamp: new Date("2024-01-01T15:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user: "Bob",
        competitor: "Competitor A",
        boost: 40,
        timestamp: new Date("2024-01-02T10:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user: "Bob",
        competitor: "Competitor B",
        boost: 120,
        timestamp: new Date("2024-01-01T20:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user: "Bob",
        competitor: "Competitor C",
        boost: 60,
        timestamp: new Date("2024-01-04T14:00:00Z"), // Day 4: decay factor 0.125
      },

      // Charlie's allocations
      {
        user: "Charlie",
        competitor: "Competitor B",
        boost: 90,
        timestamp: new Date("2024-01-02T12:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user: "Charlie",
        competitor: "Competitor C",
        boost: 200,
        timestamp: new Date("2024-01-01T08:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user: "Charlie",
        competitor: "Competitor C",
        boost: 30,
        timestamp: new Date("2024-01-03T16:00:00Z"), // Day 3: decay factor 0.25
      },
    ];

    // Calculate rewards
    const rewards = calculateRewards(
      prizePool,
      boostAllocations,
      leaderBoard,
      window,
    );

    // Verify the results structure
    expect(rewards).toHaveLength(3);

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify all users are present
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("Alice");
    expect(addresses).toContain("Bob");
    expect(addresses).toContain("Charlie");

    // Verify that rewards were distributed (total should be positive)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    expect(totalDistributed).toBeGreaterThan(0n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify Bob gets the highest reward (he has the most effective boost)
    const bobReward = rewards.find((r) => r.address === "Bob")!;
    const aliceReward = rewards.find((r) => r.address === "Alice")!;
    const charlieReward = rewards.find((r) => r.address === "Charlie")!;

    expect(aliceReward.amount).eq(294551339071887017092n);
    expect(bobReward.amount).eq(394543812352031530113n);
    expect(charlieReward.amount).eq(130663856691253951527n);
  });
});
